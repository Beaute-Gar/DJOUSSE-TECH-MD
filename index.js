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

  sessionManager.setStatus(sessionId, 'CONNECTING');
  bus.emit('session:connecting', { sessionId });

  const sock = makeWASocket({
    version,
    logger: suppressedLogger,
    printQRInTerminal: false,
    browser: ['DJOUSSE TECH', 'Chrome', '1.0'],
    auth: state,
    syncFullHistory: false,
    downloadHistory: false,
    markOnlineOnConnect: false,
    getMessage: async () => undefined
  });

  store.bind(sock.ev);
  sessionManager.setSocket(sessionId, sock);

  let lastActivity = Date.now();
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

  sock.ev.on('messages.upsert', () => { lastActivity = Date.now(); });

  const watchdogInterval = setInterval(async () => {
    if (Date.now() - lastActivity > INACTIVITY_TIMEOUT && sock.ws.readyState === 1) {
      bus.emit('session:reconnecting', { sessionId, reason: 'inactivity' });
      await sock.end(undefined, undefined, { reason: 'inactive' });
      clearInterval(watchdogInterval);
      setTimeout(() => startSession(sessionId, options), 5000);
    }
  }, 5 * 60 * 1000);

  sock.ev.on('connection.update', (update) => {
    if (update.connection === 'open') lastActivity = Date.now();
    else if (update.connection === 'close') clearInterval(watchdogInterval);
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      sessionManager.setStatus(sessionId, 'WAITING_FOR_QR');
      bus.emit('session:qr', { sessionId });
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      if (statusCode === DisconnectReason.loggedOut) {
        sessionManager.setStatus(sessionId, 'LOGGED_OUT');
        bus.emit('session:logged-out', { sessionId });
      } else {
        sessionManager.setStatus(sessionId, 'DISCONNECTED');
        bus.emit('session:disconnected', { sessionId, statusCode });
        if (shouldReconnect) {
          sessionManager.setStatus(sessionId, 'RECONNECTING');
          bus.emit('session:reconnecting', { sessionId, statusCode });
          setTimeout(() => startSession(sessionId, options), 3000);
        }
      }
    } else if (connection === 'open') {
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

      // Warm-up is now daily-based (from warmup.cjs) — no boot timer needed

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

      // Initialize Status Quotes
      try {
        const statusQuotes = require('./utils/statusQuotes');
        statusQuotes.startCacheRefresh(config.statusQuotes?.cacheRefreshHours || 6);
        if (config.statusQuotes?.enabled) {
          statusQuotes.startScheduler(sock, sessionId);
        }
      } catch (e) {}

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

  sock.ev.on('error', (error) => {
    const statusCode = error?.output?.statusCode;
    if (statusCode === 515 || statusCode === 503 || statusCode === 408) return;
    bus.emit('system:error', { source: 'socket', sessionId, error: error.message || String(error) });
  });

  return sock;
}

async function main() {
  // Start TUI
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

  // Start default session
  const sessionId = config.sessionName || 'session';
  try {
    await startSession(sessionId, {
      sessionID: config.sessionID,
      owner: config.ownerNumber?.[0],
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
