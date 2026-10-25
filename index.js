'use strict';
/**
 * DJOUSSE TECH MD — Point d'entrée hybride (Local + Render + Front-End Vercel)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const pino = require('pino');
const express = require('express');
const qrTerminal = require('qrcode-terminal');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  fetchLatestWaWebVersion,
} = require('@whiskeysockets/baileys');

const config = require('./src/config/config');
const handler = require('./src/handlers/handler');
const presence = require('./src/lib/presence');
const labelsCache = require('./src/lib/labels');
const { box, banner, renderStartupDashboard } = require('./src/config/style');
const { textOf } = require('./src/guard/utils/message');
const guardPerms = require('./src/guard/utils/perms');
const guardNight = require('./src/guard/nightmode');
const waStats = require('./src/lib/waStats');
const localDb = require('./src/lib/db');
const { DATA_DIR } = require('./src/lib/dataDir');

/* ══════════════════════════════════════════════════════════════
   1. SERVEUR EXPRESS (Render & API Vercel)
   ══════════════════════════════════════════════════════════════ */
const app = express();
app.use(express.json());

// CORS : Autorise Vercel ou n'importe quel client web à interroger l'API
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.status(200).send('DJOUSSE-TECH-MD Server is running.');
});

app.get('/status', (req, res) => {
  res.status(200).json({
    status: bridge.status,
    connected: bridge.connected,
    version: config.version || '4.0.0'
  });
});

// Route /pair demandée par connexion.js depuis Vercel
app.post('/pair', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Numéro de téléphone requis.' });
    }

    if (!activeSock) {
      return res.status(503).json({ error: 'Le socket WhatsApp n\'est pas encore prêt. Réessayez dans quelques secondes.' });
    }

    if (apiCredsState && apiCredsState.creds && apiCredsState.creds.registered) {
      return res.status(409).json({ error: 'Une session est déjà enregistrée et active.' });
    }

    const cleanPhone = String(phone).replace(/\D/g, '');
    if (!/^\d{8,15}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'Format de numéro invalide (utilisez l\'indicatif, ex: 237XXXXXXXXX).' });
    }

    pairingAttempts++;
    const rawCode = await activeSock.requestPairingCode(cleanPhone);
    const code = rawCode?.match(/.{1,4}/g)?.join('-') || rawCode;

    pairingCodeAt = Date.now();
    waStats.lastPairingCodeAt = pairingCodeAt;
    waStats.pairingAttempts = pairingAttempts;

    rawLog(`[PAIRING API] Code demandé pour +${cleanPhone} -> ${code}`);
    return res.status(200).json({ success: true, code });
  } catch (e) {
    console.error('[PAIRING API Error]:', e.message);
    return res.status(500).json({ error: e.message || 'Erreur lors de la génération du code de pairage.' });
  }
});

app.listen(PORT, () => {
  rawLog(`[HTTP] Serveur Web à l'écoute sur le port ${PORT}`);
});

/* ══════════════════════════════════════════════════════════════
   2. FILTRES & CONSOLE
   ══════════════════════════════════════════════════════════════ */

const IGNORED_ERRORS = [
  'Bad MAC', 'Failed to decrypt', 'Session error', 'libsignal',
  'session_cipher', 'decryptWithSessions', 'doDecryptWhisperMessage',
  'MessageCounterError', 'Closing open session', 'Closing session',
  'Key used already', 'Invalid PreKey', 'Duplicate Message',
  'rate-overlimit',
];

const isIgnored = (value) => {
  if (!value) return false;
  const str = typeof value === 'string' ? value : (value.message || String(value));
  return IGNORED_ERRORS.some((kw) => str.includes(kw));
};

const bridge = {
  connected: false,
  status: 'INITIALISATION',
  lastError: '',
};

const baseLog = console.log.bind(console);
const baseWarn = console.warn.bind(console);
const baseError = console.error.bind(console);

const rawLog = (...args) => baseLog(...args);
const rawError = (...args) => baseError(...args);
const rawWarn = (...args) => baseWarn(...args);

let startupDashboardShown = false;
function showStartupDashboard() {
  let storage = 'OK';
  let protections = 'INITIALISEES';

  baseLog(renderStartupDashboard({
    process: 'ACTIF',
    version: config.version || '4.0.0',
    nodeVersion: process.version,
    storage,
    commands: handler.commands.size,
    plugins: handler.loadedPlugins.length,
    protections,
    ai: config.geminiKey ? 'CLE CONFIGUREE' : 'SANS CLE',
    sessionId: path.basename(config.sessionDir) || 'principale',
    connection: bridge.status,
    activeSessions: bridge.connected ? 1 : 0,
    lastError: bridge.lastError,
  }));
  startupDashboardShown = true;
}

function setBridgeStatus(status, lastError = '') {
  bridge.status = status;
  bridge.lastError = lastError;
  if (startupDashboardShown) {
    rawLog(`[STATUS] WhatsApp : ${status}${lastError ? ` — ${lastError}` : ''}`);
  }
}

console.error = (...args) => { if (!isIgnored(args[0])) rawError(...args); };
console.warn = (...args) => { if (!isIgnored(args[0])) rawWarn(...args); };
console.log = (...args) => { if (!isIgnored(args[0])) rawLog(...args); };

const logger = pino({ level: process.env.BAILEYS_LOG || 'silent' });
if (!process.env.BAILEYS_LOG) {
  logger.debug = () => {};
  logger.trace = () => {};
}

/* ══════════════════════════════════════════════════════════════
   3. HELPER INTERACTIF TERMINAL (LOCAL)
   ══════════════════════════════════════════════════════════════ */
const ask = (query) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(query, (ans) => { rl.close(); resolve(ans.trim()); });
});

async function resolveWAVersion() {
  try {
    const r = await fetchLatestBaileysVersion({ timeout: 8000 });
    if (r?.isLatest && Array.isArray(r.version)) return r.version;
  } catch {}
  return config.stableWaVersion;
}

const processedMessages = new Set();
setInterval(() => processedMessages.clear(), 5 * 60 * 1000).unref();

let sessionEpoch = 0;
let activeSock = null;
let apiCredsState = null;
let pairingAttempts = 0;
let pairingCodeAt = 0;

/* ══════════════════════════════════════════════════════════════
   4. LOGIQUE DE SESSION WHATSAPP
   ══════════════════════════════════════════════════════════════ */
async function startSession(options = {}) {
  const epoch = ++sessionEpoch;
  setBridgeStatus('INITIALISATION');
  const sessionDir = path.resolve(__dirname, config.sessionDir);

  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  apiCredsState = state;
  const version = await resolveWAVersion();

  if (epoch !== sessionEpoch) return null;

  if (activeSock) {
    try { activeSock.ev.removeAllListeners(); } catch {}
    try { activeSock.end(undefined); } catch {}
    activeSock = null;
  }

  const sock = makeWASocket({
    version,
    logger,
    browser: Browsers.windows('Chrome'),
    printQRInTerminal: false,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    syncFullHistory: false,
    downloadHistory: false,
  });
  activeSock = sock;

  sock.ev.on('creds.update', saveCreds);

  let pairingRequested = false;
  const requestPairing = async () => {
    if (pairingRequested) return;
    if (epoch !== sessionEpoch) return;
    if (sock.authState.creds.registered) return;
    pairingRequested = true;

    // Si vous lancez le bot en local dans votre terminal, il demande le numéro
    if (process.stdin.isTTY && process.stdout.isTTY) {
      try {
        const input = await ask(
          '\n' + box('DJOUSSE-TECH-MD', [
            'Entre ton numéro WhatsApp',
            'Avec indicatif international',
            'Exemple Cameroun : 237XXXXXXXXX',
          ]) + '\n> '
        );
        const phoneNumber = String(input).replace(/\D/g, '');
        if (/^\d{8,15}$/.test(phoneNumber)) {
          pairingAttempts++;
          const rawCode = await sock.requestPairingCode(phoneNumber);
          const code = rawCode?.match(/.{1,4}/g)?.join('-') || rawCode;
          rawLog('\n' + box('CODE DE PAIRING WHATSAPP', [`Code : ${code}`]) + '\n');
        }
      } catch (e) {
        pairingRequested = false;
      }
    } else {
      rawLog('[WHATSAPP] En attente de demande de pairage via l\'interface Web (Vercel)...');
    }
  };

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (connection === 'connecting') {
      setBridgeStatus('INITIALISATION');
    }

    if (qr) {
      setBridgeStatus('EN ATTENTE');
      requestPairing();
    }

    if (connection === 'close') {
      bridge.connected = false;
      setBridgeStatus('RECONNEXION', 'Connexion coupée');
      setTimeout(() => startSession(options), 5000);
      return;
    }

    if (connection === 'open') {
      bridge.connected = true;
      setBridgeStatus('CONNECTE');
      rawLog('[SOCKET] ✅ WhatsApp CONNECTÉ avec succès !');
      if (!state.creds.registered) {
        state.creds.registered = true;
        await saveCreds().catch(() => {});
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return;
    for (const msg of messages || []) {
      try {
        if (!msg?.key?.id) continue;
        await handler.handleMessage(sock, msg);
      } catch (err) {}
    }
  });

  return sock;
}

async function main() {
  showStartupDashboard();
  await startSession();
}

if (require.main === module) {
  main().catch((err) => {
    setBridgeStatus('ERREUR', 'Démarrage impossible');
    process.exit(1);
  });
}

module.exports = { startSession, resolveWAVersion, main };