/**
 * DJOUSSE TECH MD — Command Center Entry Point
 * Intègre: TUI + Session Manager + Event Bus + AINORIA
 */

process.env.PUPPETEER_SKIP_DOWNLOAD = 'true';
process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'true';

require('dotenv').config();

const { startTUI, render } = require('./tui/index');
const bus = require('./src/core/eventBus');
const sessionManager = require('./src/sessions/sessionManager');
const ainoria = require('./src/ainoria/ainoria');

const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const config = require('./config');
const handler = require('./handler');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const processedMessages = new Set();
setInterval(() => processedMessages.clear(), 5 * 60 * 1000);

// ─── Anti-boucle reconnexion (440 CONFLICT) + timers une seule fois ───
let conflictCount = 0;
let conflictStableTimer = null;
const CONFLICT_MAX_RETRIES = 8;
let weeklyStatsInterval = null;
let statusTestRan = false;
let activeSock = null;
let activeWatchdog = null;

/* ═══════════════════════════════════════════════════════════════
   FILTRE : Ignore les erreurs Bad MAC de libsignal
   ═══════════════════════════════════════════════════════════════ */

const IGNORED_ERRORS = [
  'Bad MAC', 'Failed to decrypt', 'Session error', 'libsignal',
  'session_cipher', 'decryptWithSessions', 'doDecryptWhisperMessage',
  'MessageCounterError', 'Closing open session', 'Closing session',
  'Key used already', 'Invalid PreKey', 'Duplicate Message',
];

function isIgnoredError(msg) {
  if (!msg) return false;
  const str = typeof msg === 'string' ? msg : (msg.message || JSON.stringify(msg));
  return IGNORED_ERRORS.some(kw => str.includes(kw));
}

const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  if (isIgnoredError(args[0])) return;
  originalConsoleError(...args);
};

const originalConsoleWarn = console.warn.bind(console);
console.warn = (...args) => {
  if (isIgnoredError(args[0])) return;
  originalConsoleWarn(...args);
};

const originalConsoleLog = console.log.bind(console);
console.log = (...args) => {
  if (args[0] && typeof args[0] === 'object' && args[0].stack && isIgnoredError(args[0].stack)) return;
  if (typeof args[0] === 'string' && isIgnoredError(args[0])) return;
  originalConsoleLog(...args);
};

/* ═══════════════════════════════════════════════════════════════
   READLINE — Choix de méthode de connexion
   ═══════════════════════════════════════════════════════════════ */
const readline = require('readline');

function askQuestion(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans.trim()); }));
}

async function askConnectionMethod() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║       DJOUSSE TECH — CONNEXION WHATSAPP     ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  1 │ QR Code     — Scanner avec le téléphone ║');
  console.log('║  2 │ Pairing Code — Saisir un code 8 chiffres║');
  console.log('╚══════════════════════════════════════════════╝\n');
  const choice = await askQuestion('Choix [1/2]: ');
  if (choice === '2') {
    const phone = await askQuestion('Numéro WhatsApp (ex: 237693978044): ');
    const clean = phone.replace(/[^0-9]/g, '');
    if (!clean || clean.length < 8) {
      console.log('❌ Numéro invalide. Fallback QR Code.');
      return { method: 'qr' };
    }
    return { method: 'pairing', phone: clean };
  }
  return { method: 'qr' };
}

process.on('uncaughtException', (err) => {
  if (isIgnoredError(err.message) || isIgnoredError(err.stack)) return;
  originalConsoleError('[UNCAUGHT]', err.message);
});

process.on('unhandledRejection', (reason) => {
  const msg = reason?.message || String(reason);
  if (isIgnoredError(msg)) return;
  originalConsoleError('[UNHANDLED]', msg);
});

// ─── Arrêt auto des schedulers en cas de restriction ───
process.on('whatsapp:stop-all', ({ reason } = {}) => {
  console.log(`[SOCKET] 🛑 Arrêt de tous les schedulers — ${reason || 'inconnu'}`);
  try {
    const statusQuotes = require('./utils/statusQuotes');
    statusQuotes.stopScheduler('default');
    statusQuotes.stopCacheRefresh();
  } catch {}
});

const createSuppressedLogger = (level = 'silent') => {
  let logger;
  try {
    logger = pino({
      level,
      transport: process.env.NODE_ENV === 'production' ? undefined : {
        target: 'pino-pretty',
        options: { colorize: true, ignore: 'pid,hostname' }
      }
    });
  } catch (err) {
    logger = pino({ level });
  }
  logger.debug = () => {};
  logger.trace = () => {};
  return logger;
};

const store = {
  messages: new Map(),
  maxPerChat: 20,
  bind: (ev) => {
    ev.on('messages.upsert', ({ messages }) => {
      for (const msg of messages) {
        if (!msg.key?.id) continue;
        const jid = msg.key.remoteJid;
        if (!store.messages.has(jid)) store.messages.set(jid, new Map());
        const chatMsgs = store.messages.get(jid);
        chatMsgs.set(msg.key.id, msg);
        if (chatMsgs.size > store.maxPerChat) {
          const oldestKey = chatMsgs.keys().next().value;
          chatMsgs.delete(oldestKey);
        }
      }
    });
  },
  loadMessage: async (jid, id) => store.messages.get(jid)?.get(id) || null
};

async function startSession(sessionId, options = {}) {
  const sessionDir = path.join(__dirname, sessionId);
  sessionManager.createSession(sessionId, { ...options, status: 'INITIALIZING' });

  // Handle session ID import
  if (options.sessionID && options.sessionID.startsWith('DJOUSSE!')) {
    try {
      const [, b64data] = options.sessionID.split('!');
      if (b64data) {
        const cleanB64 = b64data.replace('...', '');
        const compressedData = Buffer.from(cleanB64, 'base64');
        const decompressedData = zlib.gunzipSync(compressedData);
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
        fs.writeFileSync(path.join(sessionDir, 'creds.json'), decompressedData, 'utf8');
      }
    } catch (e) {
      bus.emit('system:error', { source: 'session', error: e.message });
    }
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();
  const suppressedLogger = createSuppressedLogger('silent');

  // Déterminer la méthode de connexion
  const connectMethod = options.connectMethod || 'qr';
  const isPairing = connectMethod === 'pairing';

  sessionManager.setStatus(sessionId, 'CONNECTING');
  bus.emit('session:connecting', { sessionId });

  // Détruire l'ancien socket AVANT d'en créer un nouveau (évite les conflits 440 internes)
  if (activeWatchdog) {
    clearInterval(activeWatchdog);
    activeWatchdog = null;
  }
  if (activeSock) {
    try { activeSock.ev.removeAllListeners(); } catch {}
    try { activeSock.end(undefined); } catch {}
    try { activeSock.ws?.close(); } catch {}
    activeSock = null;
  }

  const sock = makeWASocket({
    version,
    logger: suppressedLogger,
    browser: ['DJOUSSE TECH', 'Chrome', '1.0'],
    auth: state,
    syncFullHistory: false,
    downloadHistory: false,
    markOnlineOnConnect: false,
    getMessage: async () => undefined
  });
  activeSock = sock;

  store.bind(sock.ev);
  sessionManager.setSocket(sessionId, sock);

  // Pairing code: écouter l'event qr (se déclenche même en mode pairing)
  if (isPairing && options.pairingPhone) {
    sock.ev.on('connection.update', async (update) => {
      const { qr } = update;
      // L'event qr se déclenche même en mode pairing — c'est le signal pour demander le code
      if (qr && !sock.authState.creds.registered) {
        try {
          let code = await sock.requestPairingCode(options.pairingPhone);
          code = code?.match(/.{1,4}/g)?.join('-') || code;
          console.log('\n╔══════════════════════════════════════════════╗');
          console.log('║         CODE DE PAIRING WHATSAPP            ║');
          console.log('╠══════════════════════════════════════════════╣');
          console.log(`║  Code: ${code}                         ║`);
          console.log('║                                              ║');
          console.log('║  1. WhatsApp > Appareils lies                ║');
          console.log('║  2. "Connecter un appareil"                  ║');
          console.log('║  3. "Lier avec un numero"                    ║');
          console.log('║  4. Entrez le code ci-dessus                 ║');
          console.log('╚══════════════════════════════════════════════╝\n');
        } catch (e) {
          console.error('[PAIRING] Erreur:', e.message);
        }
      }
    });
  }

  let lastActivity = Date.now();
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

  sock.ev.on('messages.upsert', () => { lastActivity = Date.now(); });

  const watchdogInterval = setInterval(async () => {
    if (Date.now() - lastActivity > INACTIVITY_TIMEOUT && (sock.ws?.isOpen === true || sock.ws?.socket?.readyState === 1)) {
      bus.emit('session:reconnecting', { sessionId, reason: 'inactivity' });
      await sock.end(undefined, undefined, { reason: 'inactive' });
      clearInterval(watchdogInterval);
      setTimeout(() => startSession(sessionId, options), 5000);
    }
  }, 5 * 60 * 1000);
  activeWatchdog = watchdogInterval;

  sock.ev.on('connection.update', (update) => {
    if (update.connection === 'open') lastActivity = Date.now();
    else if (update.connection === 'close') clearInterval(watchdogInterval);
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      sessionManager.setStatus(sessionId, 'WAITING_FOR_QR');
      bus.emit('session:qr', { sessionId });
      if (!isPairing) {
        qrcode.generate(qr, { small: true });
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[SOCKET] 🔌 Fermeture (code=${statusCode ?? 'inconnu'}${lastDisconnect?.error?.message ? ` — ${lastDisconnect.error.message}` : ''})`);

      // La connexion n'a pas tenu 60s → on n'autorise pas le reset du compteur 440
      if (conflictStableTimer) {
        clearTimeout(conflictStableTimer);
        conflictStableTimer = null;
      }

      // ─── Détection restriction WhatsApp ───
      // 440 = conflict (session remplacée / autre instance) → reconnexion avec backoff, PAS restriction
      // 401 = logged out, 403 = banned → restriction
      if (statusCode === 401 || statusCode === 403) {
        console.error(`🚨 COMPTE RESTREINT — code ${statusCode}`);
        try {
          const antiBan = require('./lib/anti-ban.cjs');
          antiBan.setRestricted(`Connection closed with code ${statusCode}`, statusCode);
          process.emit('whatsapp:stop-all', { reason: `restriction_${statusCode}` });
        } catch {}
      }

      if (statusCode === DisconnectReason.loggedOut) {
        sessionManager.setStatus(sessionId, 'LOGGED_OUT');
        bus.emit('session:logged-out', { sessionId });
      } else {
        sessionManager.setStatus(sessionId, 'DISCONNECTED');
        bus.emit('session:disconnected', { sessionId, statusCode });
        if (shouldReconnect) {
          // Backoff exponentiel sur CONFLICT (440)
          let delay = 3000;
          if (statusCode === 440) {
            conflictCount++;
            delay = Math.min(60000, 3000 * Math.pow(2, Math.min(conflictCount, 5)));
            console.log(`⚠️ CONFLICT (440) — tentative ${conflictCount}/${CONFLICT_MAX_RETRIES} — reconnexion dans ${delay / 1000}s...`);
            if (conflictCount >= CONFLICT_MAX_RETRIES) {
              console.error('🛑 CONFLICT (440) persistant — un autre appareil ou une autre instance détient la session.');
              console.error('   → Fermez l\'autre session/instance, puis redémarrer le bot.');
              sessionManager.setStatus(sessionId, 'CONFLICT');
              bus.emit('session:disconnected', { sessionId, statusCode, fatal: true });
              return;
            }
          }
          sessionManager.setStatus(sessionId, 'RECONNECTING');
          bus.emit('session:reconnecting', { sessionId, statusCode });
          console.log(`[SOCKET] 🔁 Reconnexion dans ${delay / 1000}s...`);
          setTimeout(() => startSession(sessionId, options), delay);
        }
      }
    } else if (connection === 'open') {
      console.log('[SOCKET] ✅ CONNECTÉ —', sock.user?.id || 'session active');
      // Reset du compteur 440 UNIQUEMENT après 60s de connexion stable
      // (un open immédiat suivi d'un 440 ne doit pas remettre le compteur à zéro)
      if (conflictStableTimer) clearTimeout(conflictStableTimer);
      conflictStableTimer = setTimeout(() => {
        conflictCount = 0;
        conflictStableTimer = null;
      }, 60 * 1000);
      const phone = sock.user.id.split(':')[0];
      sessionManager.updateSession(sessionId, { phone, status: 'CONNECTED' });
      sessionManager.setStatus(sessionId, 'CONNECTED');
      bus.emit('session:connected', { sessionId, phone });

      if (config.autoBio) {
        await sock.updateProfileStatus(`${config.botName} | Actif 24/7`).catch(() => {});
      }

      handler.initializeAntiCall(sock);

      // Initialize anti-ban system
      try {
        const antiBan = require('./lib/anti-ban.cjs');
        antiBan.init(sock);
      } catch (e) {}

      // Initialize human presence simulation
      try {
        const presence = require('./lib/presence.cjs');
        presence.init(sock);
      } catch (e) {}

      // Initialize silent automatisms (auto-read, backup, health, purge)
      try {
        const silentAuto = require('./lib/silent-automations.cjs');
        silentAuto.init(sock);
      } catch (e) {}

      // Initialize reaction automatisms
      try {
        const reactionAuto = require('./lib/reaction-automations.cjs');
        reactionAuto.init(sock);
      } catch (e) {}

      // Initialize status rotator
      try {
        const statusRotator = require('./lib/status-rotator.cjs');
        statusRotator.startRotator(() => sock);
      } catch (e) {}

      // Initialize weekly stats check (timer unique — pas de fuite à chaque reconnexion)
      try {
        const { sendWeeklyStats } = require('./lib/weekly-stats.cjs');
        if (weeklyStatsInterval) clearInterval(weeklyStatsInterval);
        weeklyStatsInterval = setInterval(() => sendWeeklyStats(sock), 300000); // Check every 5 min
      } catch (e) {}

      // Initialize reminder scheduler
      try {
        const { startReminderScheduler } = require('./lib/reminder-scheduler.cjs');
        startReminderScheduler(() => sock);
      } catch (e) {}

      // Initialize auto view-once saver
      try {
        const viewOnceSaver = require('./lib/view-once.cjs');
        viewOnceSaver.init(sock);
      } catch (e) {}

      // Auto-initialize status reaction listener (exact copy from iluser/autoreact-whatsapp)
      try {
        const autoreact = require('./lib/autoreact.cjs');
        autoreact.init(sock);
      } catch (e) {
        console.log('[AUTO-REACT] Init skipped:', e.message);
      }

      // Initialize Status Quotes (FORCÉ — indépendant de config.statusQuotes)
      try {
        const statusQuotes = require('./utils/statusQuotes');
        statusQuotes.startCacheRefresh(config.statusQuotes?.cacheRefreshHours || 6);

        // Force enabled = true dans le fichier session
        statusQuotes.updateSessionConfig(sessionId, { enabled: true });
        console.log('[STATUS-QUOTE] ✅ Config session forcée: enabled=true');

        // Redémarre le scheduler avec le socket courant (l'ancien timer tient un sock mort après reconnexion)
        statusQuotes.stopScheduler(sessionId);
        statusQuotes.startScheduler(sock, sessionId);

        // Test de publication une seule fois par processus (pas à chaque reconnexion)
        if (!statusTestRan) {
          statusTestRan = true;
          setTimeout(async () => {
            try {
              console.log('[STATUS-QUOTE] 🧪 Test de publication automatique…');
              await statusQuotes.forcePublishNow(sock, sessionId);
            } catch (e) {
              console.error('[STATUS-QUOTE] Test échoué:', e.message);
            }
          }, 2 * 60 * 1000); // 2 minutes
        }

      } catch (e) {
        console.error('[STATUS-QUOTE] Init error:', e.message, e.stack);
      }

      // Clean old messages
      const now = Date.now();
      for (const [jid, chatMsgs] of store.messages.entries()) {
        const timestamps = Array.from(chatMsgs.values()).map(m => m.messageTimestamp * 1000 || 0);
        if (timestamps.length > 0 && now - Math.max(...timestamps) > 24 * 60 * 60 * 1000) {
          store.messages.delete(jid);
        }
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  const isSystemJid = (jid) => {
    if (!jid) return true;
    return jid.includes('@broadcast') || jid.includes('status.broadcast') || jid.includes('@newsletter');
  };

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || !msg.key?.id) continue;
      const from = msg.key.remoteJid;
      if (!from || isSystemJid(from)) continue;

      const msgId = msg.key.id;
      if (processedMessages.has(msgId)) continue;

      const MESSAGE_AGE_LIMIT = 5 * 60 * 1000;
      if (msg.messageTimestamp) {
        const messageAge = Date.now() - (msg.messageTimestamp * 1000);
        if (messageAge > MESSAGE_AGE_LIMIT) continue;
      }

      processedMessages.add(msgId);
      sessionManager.incrementStat(sessionId, 'messagesReceived');

      bus.emit('message:received', {
        sessionId,
        from,
        sender: msg.key.participant || msg.key.remoteJid,
        isGroup: from.endsWith('@g.us'),
        messageId: msgId,
      });

      handler.handleMessage(sock, msg).catch(err => {
        if (!err.message?.includes('rate-overlimit')) {
          sessionManager.incrementStat(sessionId, 'errors');
          bus.emit('system:error', { source: 'handler', sessionId, error: err.message });
        }
      });

      setImmediate(async () => {
        if (config.autoRead && from.endsWith('@g.us')) {
          try { await sock.readMessages([msg.key]); } catch (e) {}
        }
        if (from.endsWith('@g.us')) {
          try {
            const groupMetadata = await handler.getGroupMetadata(sock, msg.key.remoteJid);
            if (groupMetadata) {
              await handler.handleAntilink?.(sock, msg, groupMetadata);
            }
          } catch (error) {}
        }
      });
    }
  });

  sock.ev.on('group-participants.update', async (update) => {
    await handler.handleGroupUpdate(sock, update);
  });

  // Anti-delete: intercepte les messages supprimés et les renvoie
  sock.ev.on('messages.update', async (updates) => {
    if (!config.ANTI_DELETE) return;
    for (const update of updates) {
      try {
        if (!update.update?.message && !update.update?.message === null) continue;
        const key = update.key;
        if (!key?.id || !key?.remoteJid) continue;
        if (key.remoteJid === 'status@broadcast') continue;
        if (key.fromMe) continue;

        const original = await store.loadMessage(key.remoteJid, key.id);
        if (!original || !original.message) continue;

        const sender = key.participant || key.remoteJid;
        const chatJid = key.remoteJid;
        const isGroup = chatJid.endsWith('@g.us');

        const { getContentType } = require('@whiskeysockets/baileys');
        const msgType = getContentType(original.message);
        if (!msgType) continue;

        const caption = original.message[msgType]?.caption || '';
        const text = original.message.conversation || original.message.extendedTextMessage?.text || '';
        const displayText = caption || text;

        const tag = sender.split('@')[0];
        const header = `🗑️ *Message supprimé détecté*\n👤 De: @${tag}\n⏰ Heure: ${new Date(original.messageTimestamp * 1000).toLocaleTimeString('fr-FR')}\n`;

        if (['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(msgType)) {
          const buffer = await sock.downloadMediaMessage({ key: original.key, message: original.message });
          if (buffer) {
            const mediaType = msgType.replace('Message', '').toLowerCase();
            const sendObj = { [mediaType]: buffer, caption: header + (caption ? `\n📝 ${caption}` : '') };
            if (msgType === 'audioMessage') sendObj.mimetype = 'audio/mpeg';
            await sock.sendMessage(chatJid, sendObj, { quoted: original });
          }
        } else if (displayText) {
          await sock.sendMessage(chatJid, { text: header + `\n💬 ${displayText}`, mentions: [sender] }, { quoted: original });
        }
      } catch (e) {}
    }
  });

  sock.ev.on('error', (error) => {
    const statusCode = error?.output?.statusCode;
    if (statusCode === 515 || statusCode === 503 || statusCode === 408) return;
    bus.emit('system:error', { source: 'socket', sessionId, error: error.message || String(error) });
  });

  return sock;
}

async function main() {
  // Vérifier si déjà connecté (session existante avec creds)
  const sessionId = config.sessionName || 'session';
  const sessionDir = path.join(__dirname, sessionId);
  const hasCreds = fs.existsSync(path.join(sessionDir, 'creds.json'));

  let connectMethod = 'qr';
  let pairingPhone = null;

  // Demander la méthode AVANT le TUI (évite conflit stdin)
  if (!hasCreds) {
    const choice = await askConnectionMethod();
    connectMethod = choice.method;
    pairingPhone = choice.phone || null;
  } else {
    console.log('[SESSION] Session existante détectée, reconnexion automatique...');
  }

  // Start TUI (après le choix)
  startTUI();

  // Initialize AINORIA
  await ainoria.initialize();

  // Load existing sessions
  const db = sessionManager.loadSessionsDB();
  if (db.sessions && db.sessions.length > 0) {
    for (const s of db.sessions) {
      bus.emit('session:loaded', { sessionId: s.id });
    }
  }

  try {
    await startSession(sessionId, {
      sessionID: config.sessionID,
      owner: config.ownerNumber?.[0],
      connectMethod,
      pairingPhone,
    });
  } catch (err) {
    bus.emit('system:error', { source: 'startup', error: err.message });
  }
}

// Global error handlers
process.on('uncaughtException', (err) => {
  bus.emit('system:error', { source: 'uncaught', error: err.message, stack: err.stack });
  if (err.code === 'ENOSPC') {
    const { cleanupOldFiles } = require('./utils/cleanup');
    cleanupOldFiles();
  }
});

process.on('unhandledRejection', (err) => {
  if (err?.message?.includes('rate-overlimit')) return;
  bus.emit('system:error', { source: 'unhandled', error: err?.message || String(err) });
});

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

module.exports = { store, bus, sessionManager, ainoria };
