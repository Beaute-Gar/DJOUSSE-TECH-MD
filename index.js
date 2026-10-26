const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const { 
  default: makeWASocket, 
  DisconnectReason, 
  initAuthCreds, 
  BufferJSON, 
  proto, 
  useMultiFileAuthState 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// Stockage des sockets actifs par identifiant de session (multi-sessions)
const activeSessions = new Map();
let mongoClient = null;

/**
 * Adaptateur de gestion d'état d'authentification WhatsApp sur MongoDB
 */
async function getMongoAuthState(mongoUri, sessionId) {
  if (!mongoClient) {
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    console.log('[MONGODB] Connecté à MongoDB Atlas avec succès.');
  }

  const db = mongoClient.db('whatsapp_bot');
  const collection = db.collection(`session_${sessionId}`);

  const writeData = async (data, id) => {
    try {
      const serialized = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
      await collection.updateOne({ _id: id }, { $set: { data: serialized } }, { upsert: true });
    } catch (err) {
      console.error(`[MONGODB] Échec d'écriture pour ${id}:`, err);
    }
  };

  const readData = async (id) => {
    try {
      const doc = await collection.findOne({ _id: id });
      if (!doc || !doc.data) return null;
      return JSON.parse(JSON.stringify(doc.data), BufferJSON.reviver);
    } catch (err) {
      return null;
    }
  };

  const removeData = async (id) => {
    try {
      await collection.deleteOne({ _id: id });
    } catch {}
  };

  const creds = (await readData('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          for (const id of ids) {
            let value = await readData(`${type}-${id}`);
            if (type === 'app-state-sync-key' && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            data[id] = value;
          }
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category of Object.keys(data)) {
            for (const id of Object.keys(data[category])) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              if (value) {
                tasks.push(writeData(value, key));
              } else {
                tasks.push(removeData(key));
              }
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveCreds: () => writeData(creds, 'creds')
  };
}

/**
 * Initialisation d'une instance WhatsApp isolée
 */
async function initWhatsAppSession(sessionId, cleanPhone) {
  let authState;
  const mongoUri = process.env.MONGO_URI;

  if (mongoUri) {
    authState = await getMongoAuthState(mongoUri, sessionId);
  } else {
    console.warn('[WARN] MONGO_URI absent. Utilisation du stockage local éphémère.');
    const sessionDir = path.join(__dirname, 'storage', 'sessions', sessionId);
    authState = await useMultiFileAuthState(sessionDir);
  }

  const sock = makeWASocket({
    auth: authState.state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['DJOUSSE-TECH-MD', 'Chrome', '1.0.0']
  });

  sock.ev.on('creds.update', authState.saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`[SOCKET:${sessionId}] Connexion fermée (Code ${statusCode}). Reconnexion : ${shouldReconnect}`);
      if (shouldReconnect) {
        initWhatsAppSession(sessionId, cleanPhone);
      } else {
        activeSessions.delete(sessionId);
      }
    } else if (connection === 'open') {
      console.log(`[SOCKET:${sessionId}] WhatsApp CONNECTÉ avec succès !`);
    }
  });

  // Gestion de la réception des messages
  sock.ev.on('messages.upsert', async (m) => {
    try {
      const msg = m.messages[0];
      if (!msg || msg.key.fromMe) return;
      
      const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      console.log(`[CMD:${sessionId}] Message reçu : ${body}`);
      
      // La logique de traitement de vos commandes s'exécute ici
    } catch (e) {
      console.error(`[ERROR:${sessionId}] Erreur lors du traitement :`, e);
    }
  });

  activeSessions.set(sessionId, sock);
  return sock;
}

// Lancement automatique d'une session par défaut au démarrage
const DEFAULT_SESSION = 'djsession';
initWhatsAppSession(DEFAULT_SESSION).catch(console.error);

// Route de statut
app.get('/status', (req, res) => {
  const tokenHeader = req.headers['x-api-token'];
  if (process.env.PAIRING_API_TOKEN && tokenHeader !== process.env.PAIRING_API_TOKEN) {
    return res.status(401).json({ error: 'Jeton d\'API invalide.' });
  }

  const defaultSock = activeSessions.get(DEFAULT_SESSION);
  const isConnected = Boolean(defaultSock?.user);

  return res.status(200).json({
    connected: isConnected,
    connection: isConnected ? 'open' : 'connecting',
    sessions: activeSessions.size,
    active: activeSessions.size
  });
});

// Route de génération de code de pairage
app.post('/pair', async (req, res) => {
  try {
    const tokenHeader = req.headers['x-api-token'];
    if (process.env.PAIRING_API_TOKEN && tokenHeader !== process.env.PAIRING_API_TOKEN) {
      return res.status(401).json({ error: 'Jeton d\'API invalide.' });
    }

    const { phone, sessionId: customSessionId } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Numéro de téléphone requis.' });
    }

    const cleanPhone = String(phone).replace(/\D/g, '');
    if (!/^\d{8,15}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'Format de numéro invalide.' });
    }

    // Utilise un ID personnalisé (numéro) ou la session par défaut
    const sessionId = customSessionId || `session_${cleanPhone}`;
    let sock = activeSessions.get(sessionId);

    if (!sock) {
      console.log(`[PAIRING] Création d'une nouvelle instance pour ${sessionId}...`);
      sock = await initWhatsAppSession(sessionId, cleanPhone);
    }

    // Attente active sécurisée si le socket démarre (max 5 secondes)
    let attempts = 0;
    while ((!sock || typeof sock.requestPairingCode !== 'function') && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }

    if (!sock || typeof sock.requestPairingCode !== 'function') {
      return res.status(503).json({ error: 'Le serveur initialise le socket. Réessayez dans un instant.' });
    }

    const rawCode = await sock.requestPairingCode(cleanPhone);
    const code = rawCode?.match(/.{1,4}/g)?.join('-') || rawCode;

    console.log(`[PAIRING API] Code généré pour +${cleanPhone} (Session: ${sessionId}) -> ${code}`);
    return res.status(200).json({ success: true, code });

  } catch (e) {
    console.error('[PAIRING API Error]:', e);
    return res.status(500).json({ error: e.message || 'Erreur interne lors de la génération du code.' });
  }
});

app.listen(PORT, () => {
  console.log(`[HTTP] Serveur Web prêt et à l'écoute sur le port ${PORT}`);
});