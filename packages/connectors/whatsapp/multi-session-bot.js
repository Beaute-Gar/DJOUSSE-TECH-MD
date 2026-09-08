/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  multi-session-bot.js — Point d'entrée multi-utilisateur   ║
 * ║  Chaque utilisateur possède sa propre connexion WhatsApp    ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Architecture :
 *   Utilisateur → Session Manager → WhatsApp Connector → AINORIA Core
 */

import {
  default as makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
  isJidGroup,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

import { createLogger } from '../../infrastructure/logger.js';
import { getSessionManagerV2, SESSION_EVENTS, ETATS_SESSION } from '../../infrastructure/session/session-manager-v2.js';
import { getQRHandlerV2 } from './qr-handler-v2.js';
import { getUserSpace } from '../../infrastructure/user-space/user-space.js';
import { getPermissionsStore } from './permissions-store.js';
import { usePostgresAuthStateMulti } from '../../infrastructure/session/pg-auth-v2.js';

const require = createRequire(import.meta.url);
const config = require('../../../config.cjs');
const log = createLogger('MULTI-SESSION-BOT');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sessionMgr = getSessionManagerV2();
const qrHandler = getQRHandlerV2();
const RECONNECT_DELAYS = [3000, 6000, 12000, 24000, 48000];

/**
 * Connecte le numéro WhatsApp d'un utilisateur spécifique.
 * Chaque appel crée une session isolée pour cet utilisateur.
 *
 * @param {string} userId - Identifiant unique de l'utilisateur
 * @param {object} options - Options de connexion
 */
export async function connecterSessionUtilisateur(userId, options = {}) {
  // 1. Vérifier/Créer l'espace utilisateur
  const espace = await getUserSpace(userId);
  if (!espace) {
    throw new Error(`Impossible de créer l'espace utilisateur pour ${userId}`);
  }

  // 2. Créer la session WhatsApp
  let session = await sessionMgr.getSessionParUser(userId);
  if (session && session.status === ETATS_SESSION.CONNECTED) {
    log.info(`Session déjà active pour ${userId}`);
    return session;
  }

  if (!session) {
    session = await sessionMgr.creerSession(userId, {
      sessionType: 'whatsapp',
    });
  }

  await sessionMgr.basculerEtat(session.id, ETATS_SESSION.CONNECTING);

  // 3. Connecter avec Baileys (session isolée)
  try {
    await demarrerSocket(session.id, userId, options);
  } catch (err) {
    log.error(`Erreur connexion session ${session.id}: ${err.message}`);
    await sessionMgr.basculerEtat(session.id, ETATS_SESSION.ERROR);
    throw err;
  }

  return session;
}

async function demarrerSocket(sessionId, userId, options) {
  const { state, saveCreds } = await usePostgresAuthStateMulti(userId);

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    browser: Browsers.windows('Desktop'),
    auth: {
      creds: state.creds,
      keys: state.keys,
    },
    printQRInTerminal: false,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    syncFullHistory: true,
    emitOwnEvents: false,
    retryRequestDelayMs: 2000,
    maxMsgRetryCount: 5,
    defaultQueryTimeoutMs: 30000,
    keepAliveIntervalMs: 25000,
    patchMessageBeforeSending: (msg) => {
      if (msg?.conversation) msg.conversation = msg.conversation.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      return msg;
    },
  });

  // Stocker le socket dans le gestionnaire de sessions
  await sessionMgr.mettreAJour(sessionId, { sock, saveCreds });

  // ── ÉVÉNEMENT QR ──────────────────────────────────────
  sock.ev.on('creds.update', async () => {
    try { await saveCreds(); } catch (e) { log.warn(`saveCreds: ${e.message}`); }
  });

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      await sessionMgr.enregistrerQR(sessionId, qr);
    }

    if (connection === 'open') {
      const deviceInfo = {
        user: sock.user ? `${sock.user.name || ''} (${sock.user.id || ''})` : 'inconnu',
        platform: sock.user?.device || 'unknown',
      };
      await sessionMgr.connecter(sessionId, deviceInfo);
      await espace.mettreAJour({
        whatsapp_number: sock.user?.id || null,
        last_login_at: Date.now(),
      });
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
        && !isShuttingDownSession(sessionId);

      if (shouldReconnect) {
        const session = await sessionMgr.getSession(sessionId);
        const delay = RECONNECT_DELAYS[Math.min(session?.reconnectCount || 0, RECONNECT_DELAYS.length - 1)];
        await sessionMgr.mettreAJour(sessionId, {
          status: ETATS_SESSION.RECONNECTING,
          reconnect_count: (session?.reconnectCount || 0) + 1,
        });

        log.info(`Reconnexion session ${sessionId} dans ${delay}ms...`);
        setTimeout(() => demarrerSocket(sessionId, userId, options).catch(() => {}), delay);
      } else {
        log.warn(`Session ${sessionId} déconnectée définitivement`);
        await sessionMgr.expirer(sessionId);
      }
    }
  });

  // ── ÉVÉNEMENT MESSAGES ────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
    if (type !== 'notify') return;
    for (const msg of msgs) {
      if (!msg.message || msg.key.fromMe) continue;
      try {
        await traiterMessage(sessionId, userId, msg, sock);
      } catch (err) {
        log.error(`Erreur traitement message session ${sessionId}: ${err.message}`);
      }
    }
  });
}

async function traiterMessage(sessionId, userId, msg, sock) {
  const jid = msg.key.remoteJid;
  const senderId = msg.key.participant || jid;
  const texte = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

  if (!texte.trim()) return;

  // Récupérer les permissions pour ce groupe
  const perms = getPermissionsStore(userId);
  const groupeJid = isJidGroup(jid) ? jid : null;

  if (groupeJid) {
    const verification = await perms.verifier(groupeJid, 'conversation');
    if (!verification.autorise) return;
  }

  // Passer par AINORIA Core
  try {
    const { traiter } = await import('../../ainoria-intelligence/core/ainoria-core-v2.js');
    const { reponse } = await traiter(userId, jid, texte, []);

    if (reponse) {
      await sock.sendPresenceUpdate('composing', jid);
      const delai = Math.min(Math.max(texte.split(' ').length * 200, 800), 4000);
      await new Promise(r => setTimeout(r, delai));
      await sock.sendMessage(jid, { text: reponse });
    }
  } catch (err) {
    log.error(`AINORIA Core erreur: ${err.message}`);
  }
}

const sessionsShutdown = new Set();

function isShuttingDownSession(sessionId) {
  return sessionsShutdown.has(sessionId);
}

/**
 * Arrête une session utilisateur spécifique.
 */
export async function arreterSessionUtilisateur(userId) {
  const session = await sessionMgr.getSessionParUser(userId);
  if (!session) return;

  sessionsShutdown.add(session.id);
  await sessionMgr.deconnecter(session.id);
  sessionsShutdown.delete(session.id);
}

/**
 * Arrête toutes les sessions utilisateur.
 */
export async function arreterToutesLesSessions() {
  const sessions = await sessionMgr.listerSessions();
  for (const s of sessions) {
    sessionsShutdown.add(s.id);
    await sessionMgr.deconnecter(s.id);
    sessionsShutdown.delete(s.id);
  }
  log.info('Toutes les sessions arrêtées');
}

/**
 * Point d'entrée principal pour démarrer le service multi-utilisateur.
 * Initialise le gestionnaire de sessions et le handler QR.
 */
export async function demarrerMultiSession() {
  await sessionMgr.init();
  qrHandler.init();
  log.info('Multi-session bot prêt — en attente de connexions utilisateur');
}

/**
 * Crée une nouvelle invitation + QR pour un utilisateur.
 */
export async function inviterUtilisateur(userId, options = {}) {
  await getUserSpace(userId);
  const session = await connecterSessionUtilisateur(userId, options);

  const qr = await qrHandler.attendreQR(session.id, 120000);
  return { sessionId: session.id, qr, userId };
}

export { sessionMgr, qrHandler };
