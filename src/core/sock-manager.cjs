'use strict';
/**
 * sock-manager.cjs — Gestionnaire centralisé de connexions WhatsApp.
 *
 * Architecture :
 *   - UN SEUL MongoClient partagé (via mongodb.cjs)
 *   - UN SEUL socket par connection/account
 *   - Sessions isolées par accountId (clé préfixée)
 *   - QR et Pairing Code isolés par connectionId
 *   - SSE events par connection
 *   - Compatible avec global.sock pour le bot principal
 *
 * Chaque connexion a :
 *   connectionId (UUID) → accountId → socket → session → WhatsApp
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');

function log(msg) { console.log('[SOCK-MANAGER] ' + msg); }
function warn(msg) { console.warn('[SOCK-MANAGER] ' + msg); }
function logConn(connId, msg) { console.log(`[CONN ${connId.slice(0, 8)}] ${msg}`); }

/* ══════════════════════════════════════════════════════════════════
   CONFIGURATION
   ══════════════════════════════════════════════════════════════════ */

const PAIRING_TTL = parseInt(process.env.PAIRING_TTL_MS || '600000', 10); // 10 min
const QR_TTL = parseInt(process.env.QR_TTL_MS || '120000', 10); // 2 min
const CONNECTION_TIMEOUT = parseInt(process.env.CONNECTION_TIMEOUT_MS || '120000', 10); // 2 min
const MAX_ACTIVE_CONNECTIONS = parseInt(process.env.MAX_ACTIVE_CONNECTIONS || '10', 10);
const MAX_PENDING_PER_IP = parseInt(process.env.MAX_PENDING_PER_IP || '3', 10);

/* ══════════════════════════════════════════════════════════════════
   ÉTAT INTERNE
   ══════════════════════════════════════════════════════════════════ */

/**
 * Map principale : connectionId → ConnectionEntry
 *
 * ConnectionEntry = {
 *   connectionId: string,
 *   accountId: string,
 *   phone: string,
 *   method: 'qr' | 'pairing',
 *   status: 'pending' | 'connecting' | 'pairing' | 'connected' | 'failed' | 'expired' | 'disconnected',
 *   socket: BaileysSocket | null,
 *   pairingCode: string | null,
 *   pairingExpiresAt: number | null,
 *   qr: string | null,
 *   qrDataUrl: string | null,
 *   qrExpiresAt: number | null,
 *   createdAt: number,
 *   lastActivityAt: number,
 *   expiresAt: number,
 *   timers: number[],
 *   events: EventEmitter,
 *   saveCreds: function | null,
 *   ip: string | null,
 *   telegramUserId: string | null,
 * }
 */
const connections = new Map();

/* Rate limiting par IP */
const ipPending = new Map();

/* ══════════════════════════════════════════════════════════════════
   UTILITAIRES
   ══════════════════════════════════════════════════════════════════ */

function generateId() {
  return crypto.randomUUID();
}

function maskPhone(p) {
  const s = String(p || '');
  if (s.length < 8) return s;
  return s.slice(0, 5) + '****' + s.slice(-4);
}

function cleanPhone(p) {
  let ph = String(p || '').trim().replace(/[^0-9]/g, '');
  if (ph.startsWith('00')) ph = ph.slice(2);
  return ph;
}

function isRateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const entry = ipPending.get(ip);
  if (!entry || now - entry.windowStart > 60000) {
    ipPending.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > MAX_PENDING_PER_IP;
}

function cleanupRateLimit() {
  const now = Date.now();
  for (const [ip, entry] of ipPending) {
    if (now - entry.windowStart > 120000) ipPending.delete(ip);
  }
}
setInterval(cleanupRateLimit, 60000).unref();

/* ══════════════════════════════════════════════════════════════════
   CRÉATION DE CONNEXION
   ══════════════════════════════════════════════════════════════════ */

/**
 * Crée une nouvelle connexion WhatsApp.
 *
 * @param {Object} opts
 * @param {string} opts.phone - Numéro WhatsApp (avec indicatif)
 * @param {'qr'|'pairing'} opts.method - Méthode de connexion
 * @param {string} [opts.ip] - IP du client (rate limiting)
 * @param {string} [opts.telegramUserId] - ID Telegram si connexion depuis Telegram
 * @param {string} [opts.accountId] - Account ID existant (pour reconnexion)
 *
 * @returns {{ connectionId: string, accountId: string, status: string }}
 */
function createConnection(opts) {
  const { phone, method, ip, telegramUserId, accountId } = opts;

  if (connections.size >= MAX_ACTIVE_CONNECTIONS) {
    throw new Error(`Limite de ${MAX_ACTIVE_CONNECTIONS} connexions actives atteinte`);
  }

  if (isRateLimited(ip)) {
    throw new Error('Trop de demandes en cours. Réessayez dans 1 minute.');
  }

  const connectionId = generateId();
  const accId = accountId || cleanPhone(phone);
  const now = Date.now();

  const entry = {
    connectionId,
    accountId: accId,
    phone: cleanPhone(phone),
    method: method || 'qr',
    status: 'pending',
    socket: null,
    pairingCode: null,
    pairingExpiresAt: null,
    qr: null,
    qrDataUrl: null,
    qrExpiresAt: null,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: now + CONNECTION_TIMEOUT,
    timers: [],
    events: new EventEmitter(),
    saveCreds: null,
    ip: ip || null,
    telegramUserId: telegramUserId || null,
  };

  connections.set(connectionId, entry);
  logConn(connectionId, `Créée — méthode=${method}, phone=${maskPhone(phone)}`);

  // Auto-cleanup après expiration
  const cleanupTimer = setTimeout(() => {
    if (connections.has(connectionId)) {
      const s = connections.get(connectionId);
      if (s.status !== 'connected') {
        logConn(connectionId, `Expiration — statut=${s.status}`);
        destroyConnection(connectionId);
      }
    }
  }, CONNECTION_TIMEOUT);
  entry.timers.push(cleanupTimer);

  return { connectionId, accountId: accId, status: 'pending' };
}

/* ══════════════════════════════════════════════════════════════════
   MANAGEMENT DE SOCKET
   ══════════════════════════════════════════════════════════════════ */

/**
 * Attache un socket Baileys à une connexion.
 * Appelé par account-manager ou directement par le SockManager.
 */
function attachSocket(connectionId, socket, saveCreds) {
  const entry = connections.get(connectionId);
  if (!entry) throw new Error(`Connexion ${connectionId} introuvable`);

  entry.socket = socket;
  entry.saveCreds = saveCreds;
  entry.lastActivityAt = Date.now();

  logConn(connectionId, 'Socket attaché');
  entry.events.emit('socket.attached', { connectionId });

  return entry;
}

/**
 * Met à jour le statut d'une connexion.
 */
function setStatus(connectionId, status) {
  const entry = connections.get(connectionId);
  if (!entry) return;

  const oldStatus = entry.status;
  entry.status = status;
  entry.lastActivityAt = Date.now();

  if (oldStatus !== status) {
    logConn(connectionId, `Statut: ${oldStatus} → ${status}`);
    entry.events.emit('status.changed', { connectionId, oldStatus, status });
  }
}

/**
 * Met à jour le pairing code d'une connexion.
 */
function setPairingCode(connectionId, code) {
  const entry = connections.get(connectionId);
  if (!entry) return;

  entry.pairingCode = code;
  entry.pairingExpiresAt = Date.now() + PAIRING_TTL;
  entry.lastActivityAt = Date.now();

  logConn(connectionId, `Code pairing: ${code}`);
  entry.events.emit('pairing.code', { connectionId, code, expiresAt: entry.pairingExpiresAt });
}

/**
 * Met à jour le QR d'une connexion.
 */
function setQr(connectionId, qr, qrDataUrl) {
  const entry = connections.get(connectionId);
  if (!entry) return;

  entry.qr = qr;
  entry.qrDataUrl = qrDataUrl;
  entry.qrExpiresAt = Date.now() + QR_TTL;
  entry.lastActivityAt = Date.now();

  entry.events.emit('qr.updated', { connectionId });
}

/* ══════════════════════════════════════════════════════════════════
   RECHERCHE / RÉCUPÉRATION
   ══════════════════════════════════════════════════════════════════ */

function getConnection(connectionId) {
  return connections.get(connectionId) || null;
}

function getConnectionByAccountId(accountId) {
  for (const entry of connections.values()) {
    if (entry.accountId === accountId) return entry;
  }
  return null;
}

function getConnectionByPhone(phone) {
  const ph = cleanPhone(phone);
  for (const entry of connections.values()) {
    if (entry.phone === ph) return entry;
  }
  return null;
}

function getConnectionByTelegramUserId(telegramUserId) {
  for (const entry of connections.values()) {
    if (entry.telegramUserId === telegramUserId) return entry;
  }
  return null;
}

function getSocket(connectionId) {
  const entry = connections.get(connectionId);
  return entry?.socket || null;
}

function getSocketByAccountId(accountId) {
  const entry = getConnectionByAccountId(accountId);
  return entry?.socket || null;
}

function getStatus(connectionId) {
  const entry = connections.get(connectionId);
  if (!entry) return null;
  return {
    connectionId: entry.connectionId,
    accountId: entry.accountId,
    phone: entry.phone,
    method: entry.method,
    status: entry.status,
    pairingCode: entry.pairingCode && entry.pairingExpiresAt > Date.now() ? entry.pairingCode : null,
    pairingExpiresAt: entry.pairingExpiresAt,
    hasQr: !!entry.qr,
    connected: entry.status === 'connected',
    createdAt: entry.createdAt,
    lastActivityAt: entry.lastActivityAt,
    expiresAt: entry.expiresAt,
    ip: entry.ip,
    telegramUserId: entry.telegramUserId,
  };
}

function listConnections() {
  const result = [];
  for (const entry of connections.values()) {
    result.push(getStatus(entry.connectionId));
  }
  return result;
}

/* ══════════════════════════════════════════════════════════════════
   DESTRUCTION / NETTOYAGE
   ══════════════════════════════════════════════════════════════════ */

function destroyConnection(connectionId) {
  const entry = connections.get(connectionId);
  if (!entry) return;

  logConn(connectionId, 'Destruction');

  // Nettoyer les timers
  for (const t of entry.timers) {
    try { clearTimeout(t); } catch (_) {}
  }
  entry.timers = [];

  // Fermer le socket
  if (entry.socket) {
    try {
      entry.socket.end(new Error('connection-destroyed'));
    } catch (_) {}
    entry.socket = null;
  }

  // Émettre l'événement de fermeture
  entry.events.emit('connection.closed', { connectionId });
  entry.events.removeAllListeners();

  // Supprimer de la Map
  connections.delete(connectionId);
}

function cleanupExpired() {
  const now = Date.now();
  for (const [id, entry] of connections) {
    if (entry.status !== 'connected' && entry.expiresAt < now) {
      logConn(id, 'Nettoyage expiration');
      destroyConnection(id);
    }
    // Nettoyer les QR expirés
    if (entry.qr && entry.qrExpiresAt && entry.qrExpiresAt < now) {
      entry.qr = null;
      entry.qrDataUrl = null;
      entry.qrExpiresAt = null;
    }
    // Nettoyer les codes pairing expirés
    if (entry.pairingCode && entry.pairingExpiresAt && entry.pairingExpiresAt < now) {
      entry.pairingCode = null;
      entry.pairingExpiresAt = null;
    }
  }
}
setInterval(cleanupExpired, 30000).unref();

/* ══════════════════════════════════════════════════════════════════
   COMPATIBILITÉ — global.sock pour le bot principal
   ══════════════════════════════════════════════════════════════════ */

/**
 * Définit le socket principal (bot historique).
 * Les plugins qui utilisent global.sock continuent de fonctionner.
 */
function setMainSocket(sock) {
  global.sock = sock;
  log('Socket principal défini (global.sock)');
}

/**
 * Retourne le socket principal (compatibilité plugins).
 */
function getMainSocket() {
  return global.sock || null;
}

/* ══════════════════════════════════════════════════════════════════
   HEALTH CHECK
   ══════════════════════════════════════════════════════════════════ */

function healthCheck() {
  let connected = 0;
  let pending = 0;
  let pairing = 0;
  let failed = 0;

  for (const entry of connections.values()) {
    switch (entry.status) {
      case 'connected': connected++; break;
      case 'pending':
      case 'connecting': pending++; break;
      case 'pairing': pairing++; break;
      case 'failed':
      case 'expired':
      case 'disconnected': failed++; break;
    }
  }

  return {
    total: connections.size,
    maxConnections: MAX_ACTIVE_CONNECTIONS,
    connected,
    pending,
    pairing,
    failed,
  };
}

/* ══════════════════════════════════════════════════════════════════
   EXPORTS
   ══════════════════════════════════════════════════════════════════ */

module.exports = {
  // Création
  createConnection,
  attachSocket,
  setStatus,
  setPairingCode,
  setQr,

  // Recherche
  getConnection,
  getConnectionByAccountId,
  getConnectionByPhone,
  getConnectionByTelegramUserId,
  getSocket,
  getSocketByAccountId,
  getStatus,
  listConnections,

  // Destruction
  destroyConnection,
  cleanupExpired,

  // Compatibilité bot principal
  setMainSocket,
  getMainSocket,

  // Health
  healthCheck,

  // Utilitaires
  cleanPhone,
  maskPhone,
  generateId,

  // Constantes
  MAX_ACTIVE_CONNECTIONS,
  PAIRING_TTL,
  QR_TTL,
  CONNECTION_TIMEOUT,
};
