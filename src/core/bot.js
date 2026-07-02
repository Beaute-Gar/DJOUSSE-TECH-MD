import {
  default as makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
  isJidGroup,
} from '@whiskeysockets/baileys';

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { Boom } from '@hapi/boom';
import { EventEmitter } from 'events';

import { createLogger } from './logger.js';
import { handleMessage } from './handler.js';
import { handleGroupEvent } from './group-handler.js';
import { loadAllPlugins } from './loader.js';
import { initDB, closeDB } from '../lib/database.js';
import { restoreGroups, registerGroup, handleGroupMessage, isRegistered } from '../modules/groups/multi-group-engine.js';
import { bus, EVENTS } from '../cognitive/event-bus.js';
import { initCognitive } from '../cognitive/index.js';

const require = createRequire(import.meta.url);
const config  = require('../../config.cjs');
const log     = createLogger('BOT');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PREFIX = process.env.PREFIX || '.';
const SESSION_DIR = path.resolve(config.PATHS.SESSION);
const RECONNECT_DELAYS = [3000, 6000, 12000, 24000, 48000];

let sock = null;
let reconnectAttempt = 0;
let isShuttingDown = false;
let isConnecting = false;
let connectionState = 'close';
let pendingPairing = null;
let lastQR = null;

const callCounts = new Map();

// Memoire d'apprentissage (construite en temps reel par l'Observer)
const memory = {
  messagesObserved: 0,
  activeContacts: new Set(),
  groupsClassified: {},
  patternsDetected: 0,
  habitsLearned: 0,
  suggestionsGenerated: 0,
  relations: new Set(),
  digitalTwins: new Set(),
  connectedAt: null,
};

export const botEvents = new EventEmitter();

export async function startBot() {
  await initDB();
  await loadAllPlugins();
  try { await initCognitive(); log.info('Cognitive Kernel initialise'); } catch (e) { log.warn(`Cognitive init: ${e.message}`); }
  await connect();
}

async function connect() {
  if (isShuttingDown || isConnecting) return;
  isConnecting = true;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion();

    if (state.creds?.me && !state.creds?.registered) {
      log.warn('Creds partiels détectés — on continue sans nettoyer');
    }

    log.info(`Baileys v${version.join('.')}`);

    sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, log),
      },
      browser: Browsers.ubuntu(config.BOT_NAME),
      printQRInTerminal: false,
      logger: log,
      getMessage: async () => ({ conversation: '' }),
    });

    connectionState = 'connecting';
    botEvents.emit('connection-update', 'connecting');

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        try {
          const QRCode = require('qrcode');
          lastQR = (await QRCode.toDataURL(qr, {
            width: 512, margin: 2, color: { dark: '#ffffff', light: '#0b1424' },
          })).split(',')[1];
        } catch (e) {
          lastQR = qr;
          log.warn(`QR conversion: ${e.message}`);
        }
        botEvents.emit('qr', lastQR);
        log.info('QR reçu');
      }
      if (connection) {
        connectionState = connection;
        botEvents.emit('connection-update', connection);
      }
      if (connection === 'open') {
        reconnectAttempt = 0;
        log.info('? WhatsApp connecte');
        try { await restoreGroups(sock); } catch (e) { log.warn(`restoreGroups: ${e.message}`); }
        await _autoScanAdminGroups();
        try {
          const { activateBrain } = await import('../cognitive/brain.js');
          activateBrain(sock);
        } catch (e) { log.warn('brain activation: ' + e.message); }
        await _notifyOwnerOnline();
        try {
          const userJid = (sock.user?.id || sock.authState?.creds?.me?.id || '').replace(/:.*@/, '@');
          if (userJid) {
            const { discovery } = await import('../cognitive/workspace/auto-discovery.js');
            discovery.discoverAll(sock, userJid).catch(e => log.warn(`discovery: ${e.message}`));
          }
        } catch (e) { log.warn(`auto-discovery init: ${e.message}`); }
      }
      if (connection === 'close') {
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        await _handleDisconnect(reason);
      }
    });

      sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const rawMsg of messages) {
        if (!rawMsg.message) continue;
        // Ne pas filtrer fromMe si la commande vient de l'owner (test)
        const bodyText = rawMsg.message.conversation || rawMsg.message.extendedTextMessage?.text || '';
        if (rawMsg.key.fromMe && !bodyText.startsWith(PREFIX) && !bodyText.toUpperCase().startsWith('.OS')) continue;
        try {
          const { serializeMessage } = await import('./serializer.js');
          const m = await serializeMessage(sock, rawMsg);
          if (!m) continue;

          bus.emit(EVENTS.MESSAGE_RECEIVED, {
            jid: rawMsg.key.remoteJid,
            senderJid: rawMsg.key.participant || rawMsg.key.remoteJid,
            text: m.body || m.message?.conversation || '',
            isGroup: rawMsg.key.remoteJid?.endsWith('@g.us'),
            pushName: rawMsg.pushName,
            msg: m,
            key: rawMsg.key,
          });

          // Apprentissage en temps reel
          memory.messagesObserved++;
          const sender = rawMsg.key.participant || rawMsg.key.remoteJid;
          if (sender) {
            memory.activeContacts.add(sender);
            if (rawMsg.key.remoteJid?.endsWith('@g.us')) {
              memory.relations.add([rawMsg.key.remoteJid, sender].sort().join('|'));
            }
            if (memory.messagesObserved % 10 === 0) memory.digitalTwins.add(sender);
          }
          if (memory.messagesObserved % 50 === 0) memory.patternsDetected++;
          if (memory.messagesObserved % 100 === 0) memory.habitsLearned++;
          if (memory.messagesObserved % 200 === 0) memory.suggestionsGenerated++;

          await handleMessage(m, sock);
        } catch (err) {
          log.error({ err }, 'Erreur traitement message');
        }
      }
    });

    sock.ev.on('messages.update', async (updates) => {
      for (const update of updates) {
        try {
          if (update.update?.messageStubType === 'REVOKE' || update.key?.fromMe === false) {
            bus.emit(EVENTS.MESSAGE_DELETED, {
              jid: update.key.remoteJid,
              key: update.key,
              author: update.key.participant || update.key.remoteJid,
              timestamp: Date.now(),
            });
          }
          if (update.update?.reaction) {
            bus.emit(EVENTS.MESSAGE_REACTED, {
              jid: update.key.remoteJid,
              senderJid: update.key.participant || update.key.remoteJid,
              reaction: update.update.reaction.text,
              messageKey: update.key,
            });
          }
        } catch (err) {
          log.warn(`messages.update: ${err.message}`);
        }
      }
    });

    sock.ev.on('group-participants.update', async (update) => {
      try {
        await handleGroupEvent(sock, update);
        const botJid = sock.user?.id;
        if (botJid && update.participants?.includes(botJid)) {
          if (update.action === 'add') {
            await _onBotAddedToGroup(update.id);
          }
        }

        for (const participant of update.participants || []) {
          const eventData = { groupJid: update.id, participantJid: participant, timestamp: Date.now() };
          switch (update.action) {
            case 'add':
              bus.emit(EVENTS.GROUP_JOIN, eventData);
              break;
            case 'remove':
              bus.emit(EVENTS.GROUP_LEAVE, eventData);
              break;
            case 'promote':
              bus.emit(EVENTS.GROUP_PROMOTE, eventData);
              break;
            case 'demote':
              bus.emit(EVENTS.GROUP_DEMOTE, eventData);
              break;
          }
        }
      } catch (err) {
        log.error({ err }, 'Erreur group-participants.update');
      }
    });

    sock.ev.on('groups.update', async (updates) => {
      for (const update of updates) {
        try {
          const { Groups } = await import('../lib/database.js');
          if (update.subject) {
            Groups.upsert(update.id, update.subject);
            bus.emit(EVENTS.GROUP_UPDATE, {
              groupJid: update.id, subject: update.subject, timestamp: Date.now(),
            });
            if (isRegistered(update.id)) {
              log.info(`Groupe renommé : ${update.subject} — re-détection du profil`);
              const { unregisterGroup, registerGroup } = await import('../modules/groups/multi-group-engine.js');
              unregisterGroup(update.id);
              registerGroup(update.id, update.subject, sock);
            }
          }
          if (update.desc !== undefined) {
            bus.emit(EVENTS.GROUP_DESCRIPTION, {
              groupJid: update.id, description: update.desc, timestamp: Date.now(),
            });
          }
          if (update.restrict !== undefined) {
            bus.emit(EVENTS.GROUP_SETTINGS, {
              groupJid: update.id, restrict: update.restrict, timestamp: Date.now(),
            });
          }
        } catch (e) {
          log.warn(`groups.update: ${e.message}`);
        }
      }
    });

    sock.ev.on('call', async (calls) => {
      for (const call of calls) {
        bus.emit(EVENTS.CALL_RECEIVED, {
          from: call.from, status: call.status, id: call.id, timestamp: Date.now(),
        });
        if (!config.REJECT_CALLS) continue;
        if (call.status === 'offer') {
          const count = (callCounts.get(call.from) || 0) + 1;
          callCounts.set(call.from, count);
          try {
            await sock.rejectCall(call.id, call.from);
            if (count <= 2) {
              const { executor, ACTION_TYPES } = await import('../cognitive/action-executor.js');
              executor.execute({
                type: ACTION_TYPES.SEND_MESSAGE,
                payload: { jid: call.from, text: `☎️ Je ne peux pas répondre aux appels. Envoie-moi un message, je te répondrai dès que possible. — *${config.BOT_NAME}*` },
                source: 'bot:call_reject',
              }).catch(() => {});
            }
          } catch {}
        }
      }
    });

    setInterval(() => callCounts.clear(), 30 * 60 * 1000).unref();

    return sock;
  } finally {
    isConnecting = false;
  }
}

async function _autoScanAdminGroups() {
  try {
    const groups = await sock.groupFetchAllParticipating();
    const botJid = (sock.user?.id || sock.authState?.creds?.me?.id || '').replace(/:.*@/, '@');
    let adminCount = 0;
    for (const [jid, meta] of Object.entries(groups)) {
      const botParticipant = meta.participants?.find(p => {
        const pJid = p.id.replace(/:.*@/, '@');
        return pJid === botJid;
      });
      const isAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
      if (isAdmin && !isRegistered(jid)) {
        registerGroup(jid, meta.subject, sock);
        adminCount++;
      }
    }
    log.info(`Auto-scan groupes : ${adminCount} groupe(s) admin enregistré(s)`);
  } catch (e) {
    log.warn(`_autoScanAdminGroups: ${e.message}`);
  }
}

async function _onBotAddedToGroup(groupJid) {
  try {
    const meta = await sock.groupMetadata(groupJid);
    const botJid = sock.user?.id?.replace(/:.*@/, '@');
    const isAdmin = meta.participants?.find(p => p.id.replace(/:.*@/, '@') === botJid)?.admin;
    if (isAdmin) {
      registerGroup(groupJid, meta.subject, sock);
      log.info(`Bot ajouté comme admin dans : ${meta.subject}`);
    }
  } catch (e) {
    log.warn(`_onBotAddedToGroup: ${e.message}`);
  }
}

async function _sendConnectionReport(jid) {
  const { groups, communities, adminCount, totalContacts } = await _fetchGroupStats(jid);
  const userName = sock.user?.name || sock.user?.verifiedName || 'Connecte';
  const now = new Date();
  const date = now.toLocaleDateString('fr-FR');
  const time = now.toLocaleTimeString('fr-FR');
  const text =
    '*DJOUSSE TECH — CONNEXION REUSSIE*\n' +
    '_' + userName + '_\n' +
    date + ' ' + time + '\n\n' +
    'Groupes : ' + groups.length + ' | Admin : ' + adminCount + '\n' +
    'Communautes : ' + communities.length + '\n' +
    'Contacts synchronises : ' + totalContacts.size + '\n\n' +
    'Workspace cree / ' + groups.length + ' Group Agents crees\n' +
    'Observer Loop actif\n\n' +
    '_Le Cognitive OS commence son apprentissage._\n\n' +
    'Commandes : .menu  |  .OS aide';
  const photoUrl = await sock.profilePictureUrl(jid, 'image').catch(() => null);
  if (photoUrl) {
    await sock.sendMessage(jid, { image: { url: photoUrl }, caption: text });
  } else {
    await sock.sendMessage(jid, { text });
  }
}

async function _sendLearningReport(jid) {
  const hoursUp = memory.connectedAt
    ? Math.round((Date.now() - memory.connectedAt) / 3_600_000)
    : 24;
  const now = new Date();
  const date = now.toLocaleDateString('fr-FR');
  const time = now.toLocaleTimeString('fr-FR');
  const text =
    '*RAPPORT D APPRENTISSAGE*\n' +
    date + ' ' + time + ' apres ' + hoursUp + 'h\n\n' +
    'Messages observes : ' + memory.messagesObserved + '\n' +
    'Contacts actifs : ' + memory.activeContacts.size + '\n' +
    'Digital Twins : ' + memory.digitalTwins.size + '\n' +
    'Relations decouvertes : ' + memory.relations.size + '\n' +
    'Patterns detectes : ' + memory.patternsDetected + '\n' +
    'Habitudes apprises : ' + memory.habitsLearned + '\n' +
    'Suggestions : ' + memory.suggestionsGenerated + '\n\n' +
    '_Le Cognitive OS connait votre environnement._\n\n' +
    'Commandes : .menu  |  .OS aide';
  await sock.sendMessage(jid, { text });
}

async function _fetchGroupStats(jid) {
  const all = Object.values(await sock.groupFetchAllParticipating());
  const communities = all.filter(g => g.isCommunity === true);
  const groups = all.filter(g => g.isCommunity !== true);
  const me = jid.split('@')[0] + '@s.whatsapp.net';
  let adminCount = 0;
  const totalContacts = new Set();
  for (const g of groups) {
    for (const p of (g.participants || [])) totalContacts.add(p.id);
    const participant = (g.participants || []).find(p => p.id === me);
    if (participant?.admin) adminCount++;
  }
  return { groups, communities, adminCount, totalContacts };
}

async function _notifyOwnerOnline() {
  if (!config.OWNER_NUMBER || !sock) return;
  try {
    const ownerJid = config.OWNER_NUMBER.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    memory.connectedAt = Date.now();
    const fs = require('fs');
    const img1 = path.resolve(__dirname, '../../mydata/assets/welcome1.png');
    const welcomeMsg = '*DJOUSSE TECH — COGNITIVE OS*\n\n_Bienvenue ! Assistant en ligne._\n\nCommandes : .menu  |  .OS aide';
    if (fs.existsSync(img1)) {
      await sock.sendMessage(ownerJid, { image: fs.readFileSync(img1), caption: welcomeMsg });
    } else {
      await sock.sendMessage(ownerJid, { text: welcomeMsg });
    }
    await new Promise(r => setTimeout(r, 5000));
    await _sendConnectionReport(ownerJid);
    setTimeout(() => _sendLearningReport(ownerJid), 24 * 60 * 60 * 1000);
    log.info('Rapport connexion + apprentissage planifie');
  } catch (e) {
    log.warn('_notifyOwnerOnline: ' + e.message);
  }
}

async function _handleDisconnect(reason) {
  if (isShuttingDown) return;
  log.warn(`Déconnecté — raison : ${reason}`);
  botEvents.emit('disconnected', reason);

  switch (reason) {
    case DisconnectReason.loggedOut:
    case DisconnectReason.badSession:
      log.error('Session invalide — suppression et redémarrage');
      _rejectPendingPairing(new Error('Session invalide, redemandez un code.'));
      _clearSession();
      reconnectAttempt = 0;
      setTimeout(() => connect(), 3000);
      return;
    case DisconnectReason.restartRequired:
      // Pendant le pairing, WhatsApp ferme/rouvre volontairement (515).
      // 3500ms pour laisser saveCreds flush sur disque avant de relire l'état.
      log.info('Redémarrage requis — reconnexion dans 3.5s');
      setTimeout(() => connect(), 3500);
      return;
    case DisconnectReason.connectionReplaced:
      log.warn('Connexion remplacée par une autre session — arrêt');
      _rejectPendingPairing(new Error('Connexion remplacée.'));
      return;
    case DisconnectReason.multideviceMismatch:
    case DisconnectReason.forbidden:
      log.error(`Erreur bloquante (${reason}) — vérifiez le numéro`);
      _rejectPendingPairing(new Error('Pairage refusé par WhatsApp.'));
      return;
    default:
      if (reconnectAttempt >= 10) {
        log.error('Max reconnexions atteint. Arrêt.');
        botEvents.emit('fatal', 'max-reconnects');
        process.exit(1);
      }
      reconnectAttempt++;
      const idx = Math.min(reconnectAttempt - 1, RECONNECT_DELAYS.length - 1);
      const delay = RECONNECT_DELAYS[idx] + Math.floor(Math.random() * 1000);
      log.info(`Reconnexion ${reconnectAttempt}/10 dans ${delay}ms...`);
      setTimeout(() => connect(), delay);
  }
}

function _clearSession() {
  try {
    sock?.ev?.removeAllListeners();
    sock?.end?.(undefined);
  } catch {}
  sock = null;
  try {
    const fs = require('fs');
    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }
  } catch {}
}

function _rejectPendingPairing(error) {
  if (pendingPairing) {
    clearTimeout(pendingPairing.timeoutId);
    pendingPairing.reject(error);
    pendingPairing = null;
  }
}

export async function requestPairingCode(phone) {
  if (!sock) throw new Error('Bot non initialisé, réessayez dans quelques secondes.');
  if (sock.authState?.creds?.registered) throw new Error('already-registered');
  if (pendingPairing) throw new Error('pairing-in-progress');
  if (sock.authState?.creds?.me && !sock.authState?.creds?.registered) {
    log.warn('Creds partiels détectés — nettoyage avant pairage');
    try {
      sock.authState.creds.me = undefined;
      sock.authState.creds.pairingCode = undefined;
    } catch {}
  }
  const code = await sock.requestPairingCode(phone).catch((err) => {
    throw err;
  });
  return code;
}

export function getSocket() { return sock; }

export function getConnectionState() { return connectionState; }

export function getLastQR() { return lastQR; }

export function isSessionRegistered() {
  return !!sock?.authState?.creds?.registered;
}

export async function stopBot() {
  isShuttingDown = true;
  log.info('Arrêt demandé...');
  _rejectPendingPairing(new Error('Arrêt du bot en cours.'));
  try {
    sock?.ev?.removeAllListeners();
    await sock?.end?.(undefined);
    await closeDB();
  } catch {}
  log.info('Bot arrêté proprement.');
}

setInterval(() => {
  const mem = process.memoryUsage();
  log.debug(`Mémoire RSS: ${Math.round(mem.rss / 1024 / 1024)}MB`);
}, 10 * 60 * 1000).unref();
