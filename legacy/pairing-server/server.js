/**
 * DJOUSSE TECH — WhatsApp Pairing Server
 * Génère des codes de pairing et QR codes pour connecter WhatsApp
 */

const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');
const pino = require('pino');
const QRCode = require('qrcode');
const zlib = require('zlib');
const fs = require('fs');
const crypto = require('crypto');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidNumber
} = require('@whiskeysockets/baileys');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3001;
const SESSION_DIR = path.join(__dirname, 'sessions');

// Ensure sessions directory exists
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

// Store active pairing sessions
const pairingSessions = new Map();

// Logger silencieux
const logger = pino({ level: 'silent' });

// ===== ROUTES =====

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', activeSessions: pairingSessions.size });
});

/**
 * POST /api/pair
 * Body: { phoneNumber: "+237693978044" }
 * Returns: { success: true, pairCode: "ABCD1234" }
 */
app.post('/api/pair', async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber || !phoneNumber.startsWith('+')) {
    return res.status(400).json({ error: 'Numéro invalide. Doit commencer par +' });
  }

  const phone = phoneNumber.replace(/[^0-9]/g, '');
  const sessionId = crypto.randomBytes(8).toString('hex');

  try {
    console.log(`[Pairing] Début pour ${phoneNumber} (session: ${sessionId})`);

    const result = await generatePairCode(phone, sessionId);

    if (result.error) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      pairCode: result.pairCode,
      sessionId: sessionId,
      message: 'Code généré. Entrez-le dans WhatsApp → Appareils liés → Connecter avec numéro.'
    });

  } catch (err) {
    console.error('[Pairing] Erreur:', err.message);
    res.status(500).json({ error: 'Erreur lors de la génération du code: ' + err.message });
  }
});

/**
 * GET /api/pair/status/:sessionId
 * Vérifie le statut d'un pairing
 */
app.get('/api/pair/status/:sessionId', (req, res) => {
  const session = pairingSessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session introuvable' });
  }
  res.json({
    status: session.status,
    pairCode: session.pairCode,
    phoneNumber: session.phoneNumber,
  });
});

/**
 * POST /api/pair/cancel/:sessionId
 * Annule un pairing en cours
 */
app.post('/api/pair/cancel/:sessionId', (req, res) => {
  const session = pairingSessions.get(req.params.sessionId);
  if (session) {
    session.cancelled = true;
    if (session.socket) {
      session.socket.end(undefined).catch(() => {});
    }
    pairingSessions.delete(req.params.sessionId);
  }
  res.json({ success: true });
});

// ===== PAIRING LOGIC =====

async function generatePairCode(phoneNumber, sessionId) {
  return new Promise(async (resolve) => {
    const timeout = setTimeout(() => {
      cleanupSession(sessionId);
      resolve({ error: 'Timeout — le pairing a pris trop de temps. Réessayez.' });
    }, 120000); // 2 min timeout

    try {
      const sessionPath = path.join(SESSION_DIR, sessionId);

      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        browser: ['DJOUSSE TECH Pairing', 'Chrome', '1.0'],
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        generateHighQualityLinkPreview: false,
      });

      // Store session
      pairingSessions.set(sessionId, {
        socket: sock,
        status: 'waiting',
        pairCode: null,
        phoneNumber: phoneNumber,
        createdAt: Date.now(),
      });

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
          // Successfully connected!
          console.log(`[Pairing] ${phoneNumber} connecté avec succès !`);
          clearTimeout(timeout);

          // Generate SESSION_ID for DJOUSSE TECH bot
          const sessionData = await generateSessionId(sessionPath);

          pairingSessions.set(sessionId, {
            ...pairingSessions.get(sessionId),
            status: 'connected',
            sessionId: sessionData,
          });

          // Notify via socket
          io.emit('pair:' + sessionId, {
            status: 'connected',
            sessionId: sessionData,
          });

          // Cleanup after 5 min
          setTimeout(() => {
            cleanupSession(sessionId);
          }, 5 * 60 * 1000);

          resolve({ pairCode: 'CONNECTED', sessionId: sessionData });
        }

        if (connection === 'close') {
          clearTimeout(timeout);
          const statusCode = lastDisconnect?.error?.output?.statusCode;

          if (statusCode === DisconnectReason.loggedOut) {
            cleanupSession(sessionId);
            resolve({ error: 'Déconnecté. Réessayez.' });
          } else if (statusCode === DisconnectReason.connectionClosed) {
            // Reconnect
            setTimeout(() => {
              if (!pairingSessions.get(sessionId)?.cancelled) {
                // Will auto-reconnect
              }
            }, 3000);
          }
        }
      });

      sock.ev.on('error', (err) => {
        console.error('[Pairing] Socket error:', err.message);
      });

      // ─── PAIRING CODE — appel DIRECT (référence Baileys) ─────────
      // APRÈS tous les listeners : waitForSocketOpen peut bloquer.
      // Pas dans l'event qr : il se régénère et invalide le code précédent.
      if (!state.creds.registered) {
        try {
          const cleanPhone = String(phoneNumber).replace(/\D/g, '');
          await sock.waitForSocketOpen();
          const code = await sock.requestPairingCode(cleanPhone);
          console.log(`[Pairing] Code généré: ${code}`);

          pairingSessions.set(sessionId, {
            ...pairingSessions.get(sessionId),
            status: 'code_ready',
            pairCode: code,
          });

          io.emit('pair:' + sessionId, {
            status: 'code_ready',
            pairCode: code,
          });
        } catch (err) {
          console.error('[Pairing] Erreur génération code:', err.message);
          clearTimeout(timeout);
          resolve({ error: 'Erreur génération code: ' + err.message });
          return;
        }
      }

    } catch (err) {
      clearTimeout(timeout);
      resolve({ error: err.message });
    }
  });
}

async function generateSessionId(sessionPath) {
  try {
    const credsFile = path.join(sessionPath, 'creds.json');
    if (!fs.existsSync(credsFile)) return null;

    const creds = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
    const compressed = zlib.gzipSync(JSON.stringify(creds));
    const b64 = compressed.toString('base64');
    return 'DJOUSSE!' + b64;
  } catch (err) {
    console.error('[Session] Erreur génération SESSION_ID:', err.message);
    return null;
  }
}

function cleanupSession(sessionId) {
  const session = pairingSessions.get(sessionId);
  if (session?.socket) {
    session.socket.end(undefined).catch(() => {});
  }
  pairingSessions.delete(sessionId);

  // Clean up session files after a delay
  setTimeout(() => {
    const sessionPath = path.join(SESSION_DIR, sessionId);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
  }, 60000);
}

// Cleanup old sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of pairingSessions.entries()) {
    if (now - session.createdAt > 10 * 60 * 1000) {
      cleanupSession(id);
    }
  }
}, 10 * 60 * 1000);

// ===== START =====
server.listen(PORT, () => {
  console.log(`\n🔗 DJOUSSE TECH Pairing Server`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`\nEn attente de connexions...\n`);
});
