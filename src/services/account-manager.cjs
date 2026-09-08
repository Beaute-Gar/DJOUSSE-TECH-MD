// src/services/account-manager.cjs
// Gestion multi-comptes WhatsApp : inscription, connexion par CODE D'APPAIRAGE
// (plus aucun QR), session MongoDB par compte, socket Baileys par compte.
// Architecture : UN SEUL MongoClient partagé, UN SEUL socket par compte, sessions isolées.
let _bs = null;
function bs() {
  if (_bs) return _bs;
  try {
    _bs = require('@whiskeysockets/baileys');
  } catch (e) {
    throw new Error('Multi-comptes désactivé : @whiskeysockets/baileys non installé');
  }
  return _bs;
}
const { attachAccountPipeline } = require('./account-pipeline.cjs');
const moderationManager = require('./auto-moderation.cjs');

const MAX_ACCOUNTS = parseInt(process.env.MAX_ACCOUNTS || '4', 10);
const PAIRING_TTL = 10 * 60 * 1000; /* code valable 10 min */
const MAX_RECONNECT_DELAY = 120000;
const RATE_LIMIT_WINDOW = 60 * 1000; /* 1 minute */
const MAX_PAIRING_PER_PHONE = 3; /* max 3 tentatives par numéro par minute */

let acctDB = null;
const sockets = new Map(); /* accountId -> { sock, timers[], status, pairingCode, expiresAt, attempts, ... } */
let onStatusChange = null;
let onQrHook = null;

/* ---- Rate limiting ---- */
const phoneAttempts = new Map(); /* phone -> { count, windowStart } */

function isRateLimited(phone) {
  const now = Date.now();
  const entry = phoneAttempts.get(phone);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    phoneAttempts.set(phone, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > MAX_PAIRING_PER_PHONE;
}

function now() { return Date.now(); }

function maskPhone(p) {
  const s = String(p || '');
  if (s.length < 8) return s;
  return s.slice(0, 5) + '****' + s.slice(-4);
}

function logAccount(accountId, msg) { console.log(`[ACCOUNT #${accountId}] ${msg}`); }
function logPairing(msg) { console.log(`[PAIRING] ${msg}`); }

function cleanPhone(p) {
  let ph = String(p || '').trim().replace(/[^0-9]/g, '');
  if (ph.startsWith('00')) ph = ph.slice(2);
  return ph;
}

async function db() {
  if (acctDB) return acctDB;
  const mongoAuth = require('./mongo-auth.cjs');
  acctDB = await mongoAuth.getAccountDB();
  return acctDB;
}

function setStatus(accountId, status) {
  const s = sockets.get(accountId);
  if (s) s.status = status;
  try { if (typeof onStatusChange === 'function') onStatusChange(accountId, status); } catch (_) {}
}

/* ══ INSCRIPTION / CONNEXION ══ */
async function registerAccount({ nom, prenom, phone }) {
  const d = await db();
  if (!d) throw new Error('Base de données indisponible');
  const ph = cleanPhone(phone);
  if (!ph || ph.length < 8) throw new Error('Numéro de téléphone invalide');
  let row = await d.get('SELECT * FROM wa_accounts WHERE phone = ?', ph);
  if (row) return { ...row, alreadyRegistered: true };
  if (sockets.size >= MAX_ACCOUNTS && (await countAccounts()) >= MAX_ACCOUNTS) {
    throw new Error('Limite de ' + MAX_ACCOUNTS + ' comptes atteinte');
  }
  await d.run('INSERT INTO wa_accounts (id, nom, prenom, phone, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ph, String(nom || '').trim(), String(prenom || '').trim(), ph, 'pending', now());
  row = await d.get('SELECT * FROM wa_accounts WHERE phone = ?', ph);
  logAccount(ph, `Inscrit (${maskPhone(ph)})`);
  return row;
}

async function loginAccount(phone) {
  const d = await db();
  const ph = cleanPhone(phone);
  if (!d || !ph) throw new Error('Numéro invalide');
  const row = await d.get('SELECT * FROM wa_accounts WHERE phone = ?', ph);
  if (!row) throw new Error('Aucun compte avec ce numéro. Inscrivez-vous d\'abord.');
  return row;
}

async function countAccounts() {
  const d = await db();
  if (!d) return 0;
  const r = await d.get('SELECT COUNT(*) AS n FROM wa_accounts');
  return Number(r?.n || 0);
}

/* ══ CODE D'APPAIRAGE ══ */
/* Crée (ou réutilise) le socket du compte et demande un code de connexion. */
async function connectAccount(accountId, { generatePairing = false } = {}) {
  const d = await db();
  const row = await d.get('SELECT * FROM wa_accounts WHERE id = ?', accountId);
  if (!row) throw new Error('Compte introuvable');

  /* Rate limiting */
  if (generatePairing && isRateLimited(row.phone)) {
    throw new Error('Trop de demandes. Réessayez dans 1 minute.');
  }

  if (sockets.has(accountId)) {
    const existing = sockets.get(accountId);
    if (existing.sock?.user) return { account: row, code: null, alreadyConnected: true };
    if (generatePairing) {
      /* Cleanup l'ancien socket proprement */
      for (const t of (existing.timers || [])) { try { clearTimeout(t); } catch (_) {} }
      try { await existing.sock.end(new Error('re-pairing')); } catch (_) {}
      sockets.delete(accountId);
    } else {
      return { account: row, code: null, alreadyConnected: false };
    }
  }

  const mongoAuth = require('./mongo-auth.cjs');

  /* Repairage : on repart de ZÉRO (session effacée) */
  if (generatePairing) {
    try { await mongoAuth.clearAccountSession(row.id); } catch (e) { logAccount(accountId, `clear session: ${e.message}`); }
  }

  const { state, saveCreds } = await mongoAuth.useMongoAuthStateForAccount(row.id);

  /* Baileys chargé UNIQUEMENT ici (en mode wwebjs ce code n'est pas atteint) */
  const { default: makeWASocket, fetchLatestBaileysVersion, Browsers, DisconnectReason } = bs();
  const pino = require('pino');

  let version;
  try {
    const fv = await fetchLatestBaileysVersion();
    version = Array.isArray(fv?.version) && fv.version.length === 3
      ? fv.version
      : undefined;
  } catch (e) {
    logAccount(accountId, `fetchVersion: ${e.message}`);
    version = undefined;
  }

  const current = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
    syncFullHistory: false,
    markOnlineOnConnect: true,
  });
  try { current.ev.setMaxListeners && current.ev.setMaxListeners(0); } catch (_) {}

  const entry = {
    sock: current,
    timers: [],
    status: 'connecting',
    pairingCode: null,
    expiresAt: 0,
    attempts: 0,
    pairAttempts: 0,
    pairRequested: false,
    row
  };
  sockets.set(accountId, entry);
  setStatus(accountId, 'connecting');
  logAccount(accountId, `Connexion en cours (${maskPhone(row.phone)})`);

  const schedule = (fn, ms) => { const t = setTimeout(fn, ms); entry.timers.push(t); return t; };

  current.ev.on('creds.update', saveCreds);

  current.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (sockets.get(accountId)?.sock !== current) return;

    /* Hook QR pour le multi-comptes */
    if (qr && typeof onQrHook === 'function') {
      onQrHook(accountId, qr);
    }

    /* Pairing Code : indépendant du QR. */
    if (generatePairing && !entry.pairingCode && !entry.pairRequested &&
        connection !== 'open' && connection !== 'close' && entry.pairAttempts < 4) {
      entry.pairAttempts += 1;
      entry.pairRequested = true;

      const requestPairing = async () => {
        try {
          await new Promise(r => setTimeout(r, 1200));
          if (sockets.get(accountId)?.sock !== current) return;

          const code = await current.requestPairingCode(row.phone);
          if (!code) throw new Error('Baileys n\'a retourné aucun code');

          entry.pairingCode = String(code);
          entry.expiresAt = now() + PAIRING_TTL;

          await d.run(
            'UPDATE wa_accounts SET pairing_code = ?, pairing_expires_at = ?, status = ? WHERE id = ?',
            entry.pairingCode, entry.expiresAt, 'pairing', accountId
          ).catch(() => {});

          setStatus(accountId, 'pairing');
          logPairing(`Code #${accountId}: ${entry.pairingCode} (expire dans ${PAIRING_TTL / 60000}min)`);
        } catch (e) {
          entry.pairRequested = false;
          logAccount(accountId, `requestPairingCode tentative ${entry.pairAttempts}/4: ${e.message}`);

          if (entry.pairAttempts < 4 && sockets.get(accountId)?.sock === current) {
            schedule(() => {
              if (sockets.get(accountId)?.sock !== current || entry.pairingCode) return;
              connectAccount(accountId, { generatePairing: true }).catch(() => {});
            }, 2500);
          }
        }
      };

      requestPairing().catch(() => {});
    }

    if (connection === 'open') {
      entry.attempts = 0;
      entry.status = 'active';
      entry.pairingCode = null;
      try {
        await d.run('UPDATE wa_accounts SET status = ?, pairing_code = \'\', pairing_expires_at = 0, last_seen = ? WHERE id = ?',
          'active', now(), accountId);
      } catch (_) {}
      const ownNum = String(current.user?.id || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
      try {
        moderationManager.configureAdmins(current, [ownNum + '@s.whatsapp.net']);
        moderationManager.start(current);
      } catch (e) { logAccount(accountId, `modération: ${e.message}`); }
      logAccount(accountId, `✅ Connecté (${row.prenom || row.nom || maskPhone(row.phone)})`);
      setStatus(accountId, 'active');
    } else if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const s = sockets.get(accountId);
      if (s) s.sock = null;
      sockets.delete(accountId);
      if (code === DisconnectReason.loggedOut || code === DisconnectReason.forbidden) {
        logAccount(accountId, `🔐 Session invalide — nouveau pairage requis`);
        try {
          await d.run(
            'UPDATE wa_accounts SET status = ?, pairing_code = \'\', pairing_expires_at = 0 WHERE id = ?',
            'pending', accountId
          );
        } catch (_) {}
        setStatus(accountId, 'pending');
      } else if (code === DisconnectReason.connectionReplaced) {
        logAccount(accountId, `⚔️ Connecté ailleurs — arrêt de cette instance`);
        setStatus(accountId, 'replaced');
        try { await d.run('UPDATE wa_accounts SET status = ? WHERE id = ?', 'pending', accountId); } catch (_) {}
      } else {
        entry.attempts++;
        const delay = Math.min(5000 * Math.pow(2, Math.min(entry.attempts - 1, 5)), MAX_RECONNECT_DELAY);
        logAccount(accountId, `🔄 Déconnecté (code ${code}) — reconnexion dans ${Math.round(delay / 1000)}s`);
        schedule(() => { connectAccount(accountId).catch(() => {}); }, delay);
      }
    }
  });

  /* Pipeline complet (toutes les commandes) + événements internes */
  const pipeline = attachAccountPipeline(current, {
    ownerNumber: row.phone,
    onEvent: (ev) => {
      if (ev === 'session-broken') {
        try { current.end(new Error('session-broken')); } catch (_) {}
        schedule(() => { connectAccount(accountId, { generatePairing: true }).catch(() => {}); }, 2000);
      } else if (ev === 'restart-request') {
        schedule(() => { connectAccount(accountId).catch(() => {}); }, 1000);
      }
    },
  });
  entry.pipeline = pipeline;

  /* Laisse jusqu'à 90 s au socket pour obtenir le code. */
  if (generatePairing) {
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 500));
      const s = sockets.get(accountId);
      if (!s || s.sock !== current) break;
      if (s.pairingCode) return { account: row, code: s.pairingCode, expiresAt: s.expiresAt };
      if (s.status === 'active') return { account: row, code: null, alreadyConnected: true };
    }
    /* Timeout : cleanup propre */
    try { current.end(new Error('pairing-timeout')); } catch (_) {}
    for (const t of entry.timers) { try { clearTimeout(t); } catch (_) {} }
    sockets.delete(accountId);
    logAccount(accountId, `⏰ Pairing timeout après 90s`);
    throw new Error('Délai dépassé pour la génération du code d\'appairage (90s)');
  }
  return { account: row, code: null, alreadyConnected: false };
}

/* ══ DÉCONNEXION / SUPPRESSION ══ */
async function disconnectAccount(accountId) {
  const entry = sockets.get(accountId);
  if (entry) {
    for (const t of entry.timers) { try { clearTimeout(t); } catch (_) {} }
    try {
      const sock = entry.sock;
      await Promise.race([
        sock?.logout?.(),
        new Promise(r => setTimeout(r, 4000)),
      ]);
    } catch (_) {}
    try { entry.sock?.end?.(new Error('disconnect')); } catch (_) {}
    sockets.delete(accountId);
    logAccount(accountId, `Déconnecté`);
  }
  const d = await db();
  try { await d.run('UPDATE wa_accounts SET status = ? WHERE id = ?', 'disconnected', accountId); } catch (_) {}
  setStatus(accountId, 'disconnected');
}

async function unregisterAccount(accountId) {
  await disconnectAccount(accountId);
  const mongoAuth = require('./mongo-auth.cjs');
  try { await mongoAuth.clearAccountSession(accountId); } catch (_) {}
  const d = await db();
  try { await d.run('DELETE FROM wa_accounts WHERE id = ?', accountId); } catch (_) {}
  logAccount(accountId, `Supprimé`);
}

/* ══ DÉMARRAGE (au boot : relance les comptes actifs) ══ */
async function startAllAccounts() {
  const d = await db();
  if (!d) return { started: 0 };
  const rows = await d.all('SELECT * FROM wa_accounts WHERE status = ?', 'active');
  logPairing(`Démarrage de ${rows.length} compte(s) actif(s)`);
  for (const row of rows) {
    connectAccount(row.id).catch(e => logAccount(row.id, `Erreur démarrage: ${e.message}`));
  }
  return { started: rows.length };
}

async function getAccounts() {
  const d = await db();
  if (!d) return [];
  const rows = await d.all('SELECT * FROM wa_accounts ORDER BY created_at DESC');
  return rows.map(r => {
    const entry = sockets.get(r.id);
    return {
      id: r.id, nom: r.nom, prenom: r.prenom, phone: r.phone,
      status: entry?.status || r.status,
      connected: Boolean(entry?.sock?.user),
      pairing_code: (entry?.pairingCode || r.pairing_code) && (entry?.expiresAt || r.pairing_expires_at) > now() ? (entry?.pairingCode || r.pairing_code) : '',
      pairing_expires_at: entry?.expiresAt || r.pairing_expires_at,
      last_seen: r.last_seen, created_at: r.created_at,
    };
  });
}

async function getAccountStatus(accountId) {
  const d = await db();
  if (!d) return null;
  const r = await d.get('SELECT * FROM wa_accounts WHERE id = ?', accountId);
  if (!r) return null;
  const entry = sockets.get(r.id);
  return {
    id: r.id, nom: r.nom, prenom: r.prenom, phone: r.phone,
    status: entry?.status || r.status,
    connected: Boolean(entry?.sock?.user),
    pairing_code: (entry?.pairingCode || r.pairing_code) && (entry?.expiresAt || r.pairing_expires_at) > now() ? (entry?.pairingCode || r.pairing_code) : '',
    pairing_expires_at: entry?.expiresAt || r.pairing_expires_at,
  };
}

/* ---- Health check ---- */
function healthCheck() {
  const entries = Array.from(sockets.entries()).map(([id, s]) => ({
    id,
    status: s.status,
    connected: Boolean(s.sock?.user),
  }));
  return {
    maxAccounts: MAX_ACCOUNTS,
    activeSockets: sockets.size,
    entries,
  };
}

module.exports = {
  registerAccount, loginAccount, connectAccount, disconnectAccount, unregisterAccount,
  startAllAccounts, getAccounts, getAccountStatus, setOnStatusChange: (fn) => { onStatusChange = fn; },
  setOnQr: (fn) => { onQrHook = fn; },
  cleanPhone, MAX_ACCOUNTS, sockets, healthCheck,
};
