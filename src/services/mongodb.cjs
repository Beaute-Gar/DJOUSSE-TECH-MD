'use strict';
/**
 * mongodb.cjs — Service central MongoDB pour DJOUSSE-TECH-MD.
 *
 * Architecture :
 *   - UN SEUL MongoClient partagé dans toute l'application
 *   - Pool de connexions géré par le driver MongoDB officiel
 *   - Pas de connexion par requête
 *   - Health check exposed
 *   - Fermeture propre à l'arrêt du processus
 *
 * Collections utilisées :
 *   - accounts            : comptes WhatsApp multi-users
 *   - whatsapp_sessions   : auth state Baileys (creds + keys)
 *   - pairing_sessions    : sessions d'appairage en cours
 */

const { MongoClient } = require('mongodb');
const config = require('../../config.cjs');

function log(msg) { console.log('[MONGODB] ' + msg); }
function warn(msg) { console.warn('[MONGODB] ' + msg); }

/* ══════════════════════════════════════════════════════════════════
   CLIENT SINGLETON
   ══════════════════════════════════════════════════════════════════ */

let _client = null;
let _db = null;
let _connecting = null;

const DB_NAME = config.MONGO_DB_NAME || 'djousse_tech';
const MONGO_URI = config.MONGODB_URI || '';

/**
 * Retourne le MongoClient partagé. Crée la connexion au premier appel.
 * Thread-safe : si une connexion est déjà en cours, l'attend.
 */
async function connectMongo() {
  if (_client && _client.topology?.isConnected()) return _client;
  if (_connecting) return _connecting;

  if (!MONGO_URI) {
    throw new Error('MONGODB_URI non configuré — impossible de se connecter à MongoDB');
  }

  _connecting = (async () => {
    const maxRetries = 3;
    let lastErr;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const client = new MongoClient(MONGO_URI, {
          maxPoolSize: 10,
          minPoolSize: 1,
          connectTimeoutMS: 20000,
          serverSelectionTimeoutMS: 20000,
          heartbeatFrequencyMS: 30000,
          retryWrites: true,
          retryReads: true,
          tls: true,
          tlsAllowInvalidCertificates: true,
          tlsAllowInvalidHostnames: true,
        });

        await client.connect();
        // Vérification explicite de la connexion
        await client.db(DB_NAME).command({ ping: 1 });

        _client = client;
        _db = client.db(DB_NAME);
        log(`Connecté à MongoDB Atlas (base: ${DB_NAME})`);
        _connecting = null;
        return _client;
      } catch (err) {
        lastErr = err;
        warn(`Tentative ${attempt}/${maxRetries} échouée: ${err.message}`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 2000 * attempt));
        }
      }
    }

    _connecting = null;
    throw new Error(`MongoDB injoignable après ${maxRetries} tentatives: ${lastErr?.message}`);
  })();

  return _connecting;
}

/**
 * Retourne la base de données MongoDB.
 */
async function getMongoDb() {
  if (_db && _client?.topology?.isConnected()) return _db;
  await connectMongo();
  return _db;
}

/**
 * Retourne une collection MongoDB.
 * @param {string} name - Nom de la collection
 */
async function getCollection(name) {
  const db = await getMongoDb();
  return db.collection(name);
}

/* ══════════════════════════════════════════════════════════════════
   NOMS DE COLLECTIONS
   ══════════════════════════════════════════════════════════════════ */

const COLLECTIONS = {
  ACCOUNTS: 'accounts',
  SESSIONS: 'whatsapp_sessions',
  PAIRING: 'pairing_sessions',
};

/**
 * Initialise les index MongoDB (appeler au démarrage).
 */
async function ensureIndexes() {
  try {
    const accounts = await getCollection(COLLECTIONS.ACCOUNTS);
    await accounts.createIndex({ phone: 1 }, { unique: true });
    await accounts.createIndex({ id: 1 }, { unique: true });
    await accounts.createIndex({ status: 1 });

    const sessions = await getCollection(COLLECTIONS.SESSIONS);
    await sessions.createIndex({ accountId: 1, key: 1 }, { unique: true });
    await sessions.createIndex({ accountId: 1 });

    const pairing = await getCollection(COLLECTIONS.PAIRING);
    await pairing.createIndex({ accountId: 1 }, { unique: true });
    await pairing.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    log('Index MongoDB créés/vérifiés');
  } catch (err) {
    warn(`ensureIndexes: ${err.message}`);
  }
}

/* ══════════════════════════════════════════════════════════════════
   HEALTH CHECK
   ══════════════════════════════════════════════════════════════════ */

async function checkMongoHealth() {
  try {
    if (!_client || !_client.topology?.isConnected()) {
      await connectMongo();
    }
    const db = await getMongoDb();
    const result = await db.command({ ping: 1 });
    return {
      status: 'online',
      ok: result.ok === 1,
      database: DB_NAME,
    };
  } catch (err) {
    return {
      status: 'error',
      error: err.message,
    };
  }
}

/**
 * Ferme proprement la connexion MongoDB.
 */
async function closeMongo() {
  if (_client) {
    try {
      await _client.close();
      log('Connexion MongoDB fermée');
    } catch (_) {}
    _client = null;
    _db = null;
  }
}

// Fermeture propre à l'arrêt du processus
process.on('SIGINT', async () => { await closeMongo(); process.exit(0); });
process.on('SIGTERM', async () => { await closeMongo(); process.exit(0); });

module.exports = {
  connectMongo,
  getMongoDb,
  getCollection,
  checkMongoHealth,
  closeMongo,
  ensureIndexes,
  COLLECTIONS,
  DB_NAME,
};
