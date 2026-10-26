'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  Browsers,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const config = require('./src/config/config');
const handler = require('./src/handlers/handler');

// ══════════════════════════════════════════════════════════════
// SERVEUR EXPRESS (Render & API Vercel)
// ══════════════════════════════════════════════════════════════
const app = express();
app.use(express.json());

// Gestion des CORS pour autoriser les requêtes venant de Vercel
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-token');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const PORT = process.env.PORT || 3000;

let bridge = {
  connected: false,
  status: 'INITIALISATION',
  lastError: '',
};

let activeSock = null;
let apiCredsState = null;
let pairingAttempts = 0;

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

// Route /pair appelée par le site web (Vercel) pour générer le code
app.post('/pair', async (req, res) => {
  try {
    // Vérification optionnelle du token si configuré
    const tokenHeader = req.headers['x-api-token'];
    if (process.env.PAIRING_API_TOKEN && tokenHeader !== process.env.PAIRING_API_TOKEN) {
      return res.status(401).json({ error: 'Jeton d\'API invalide.' });
    }

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
      return res.status(400).json({ error: 'Format de numéro invalide.' });
    }

    pairingAttempts++;
    const rawCode = await activeSock.requestPairingCode(cleanPhone);
    const code = rawCode?.match(/.{1,4}/g)?.join('-') || rawCode;

    console.log(`[PAIRING API] Code généré pour +${cleanPhone} -> ${code}`);
    return res.status(200).json({ success: true, code });
  } catch (e) {
    console.error('[PAIRING API Error]:', e.message);
    return res.status(500).json({ error: e.message || 'Erreur lors de la génération du code.' });
  }
});

app.listen(PORT, () => {
  console.log(`[HTTP] Serveur Web à l'écoute sur le port ${PORT}`);
});

// ══════════════════════════════════════════════════════════════
// SESSION WHATSAPP (Baileys)
// ══════════════════════════════════════════════════════════════
async function resolveWAVersion() {
  try {
    const r = await fetchLatestBaileysVersion({ timeout: 8000 });
    if (r?.isLatest && Array.isArray(r.version)) return r.version;
  } catch {}
  return [2, 3000, 1015901307];
}

async function startSession() {
  bridge.status = 'INITIALISATION';
  const sessionDir = path.resolve(__dirname, config.sessionDir || './storage/sessions/djsession');

  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  apiCredsState = state;
  const version = await resolveWAVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    browser: Browsers.windows('Chrome'),
    printQRInTerminal: false,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
    syncFullHistory: false,
  });
  activeSock = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection } = update;

    if (connection === 'connecting') {
      bridge.status = 'INITIALISATION';
    }

    if (connection === 'close') {
      bridge.connected = false;
      bridge.status = 'RECONNEXION';
      setTimeout(() => startSession(), 5000);
    }

    if (connection === 'open') {
      bridge.connected = true;
      bridge.status = 'CONNECTE';
      console.log('[SOCKET] WhatsApp CONNECTÉ avec succès !');
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

startSession();