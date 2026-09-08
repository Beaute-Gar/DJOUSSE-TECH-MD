'use strict';
/**
 * mongo-auth.cjs — État d'authentification WhatsApp persistant en MongoDB.
 *
 * Remplace pg-auth.cjs avec la même signature Baileys :
 *   { state: { creds, keys }, saveCreds }
 *
 * Architecture :
 *   - Collection `whatsapp_sessions` : stockage clé/valeur préfixé par accountId
 *   - Collection `accounts` : métadonnées des comptes WhatsApp
 *   - Serialisation JSON-safe avec gestion des Buffers (Base64)
 *   - Fallback local si MongoDB injoignable
 *   - Isolation totale par accountId
 *   - Compatible multi-comptes simultanés
 *
 * Structure MongoDB :
 *   whatsapp_sessions: { _id, accountId, key, value, createdAt, updatedAt }
 *   accounts: { _id, id, nom, prenom, phone, status, pairing_code, ... }
 */

const fs = require('fs');
const path = require('path');
const { getCollection, ensureIndexes, COLLECTIONS } = require('./mongodb.cjs');

function log(msg) { console.log('[MONGO-AUTH] ' + msg); }
function warn(msg) { console.warn('[MONGO-AUTH] ' + msg); }

/* ══════════════════════════════════════════════════════════════════
   SÉRIALISATION (Buffers ↔ JSON)
   ══════════════════════════════════════════════════════════════════ */

function bufferReviver(key, value) {
  if (value && typeof value === 'object' && value.type === 'Buffer' && Array.isArray(value.data)) {
    return Buffer.from(value.data);
  }
  return value;
}

function credsStringify(obj) {
  return JSON.stringify(obj, (key, val) => {
    if (typeof val === 'object' && val !== null && val.type === 'Buffer' && Array.isArray(val.data)) return val;
    if (Buffer.isBuffer(val)) return { type: 'Buffer', data: Array.from(val) };
    return val;
  });
}

function credsParse(str) {
  return JSON.parse(str, bufferReviver);
}

function reviveCreds(raw) {
  if (typeof raw === 'string') return credsParse(raw);
  if (Buffer.isBuffer(raw)) return raw;
  if (raw === null || raw === undefined || typeof raw !== 'object') return raw;
  if (raw.type === 'Buffer' && Array.isArray(raw.data)) return Buffer.from(raw.data);
  if (Array.isArray(raw)) return raw.map(reviveCreds);
  const result = {};
  for (const [k, v] of Object.entries(raw)) result[k] = reviveCreds(v);
  return result;
}

/* ══════════════════════════════════════════════════════════════════
   SAUVEGARDE LOCALE (backup d'urgence uniquement)
   ══════════════════════════════════════════════════════════════════ */

function saveToLocal(creds, accountId = 'main') {
  try {
    const dir = accountId === 'main' ? './session' : `./session/acct-${accountId}`;
    const filePath = path.join(dir, 'creds.json');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, credsStringify(creds));
  } catch (e) {
    warn(`saveToLocal: ${e.message}`);
  }
}

/* ══════════════════════════════════════════════════════════════════
   BOT PRINCIPAL — useMongoAuthState()
   ══════════════════════════════════════════════════════════════════ */

async function useMongoAuthState(forceNew = false) {
  await ensureIndexes();
  const col = await getCollection(COLLECTIONS.SESSIONS);

  // Charger les credentials — MongoDB UNIQUEMENT (source de vérité)
  let creds = null;
  try {
    const doc = await col.findOne({ accountId: 'main', key: 'creds' });
    if (doc?.value) {
      // Si forceNew, ignorer les credentials existantes (elles sont invalides)
      if (!forceNew) {
        creds = reviveCreds(doc.value);
        log('Session WhatsApp restaurée depuis MongoDB');
      } else {
        log('forceNew=true — credentials MongoDB ignorées, nouvelle session requise');
      }
    } else {
      // PAS de credentials main → ne JAMAIS copier celles d'un autre compte
      // Laisser le bot générer un QR frais
      log('Pas de credentials main dans MongoDB — nouvelle session requise');
    }
  } catch (e) {
    // MongoDB indisponible → erreur explicite, JAMAIS de fallback silencieux
    const err = new Error(`MONGODB_UNAVAILABLE: impossible de lire les credentials — ${e.message}`);
    err.code = 'MONGODB_UNAVAILABLE';
    throw err;
  }

  // Nouvelle session (pas encore de credentials dans MongoDB)
  if (!creds) {
    const { initAuthCreds } = require('@whiskeysockets/baileys');
    creds = initAuthCreds();
    log('Nouvelle session WhatsApp créée (pas de credentials existants)');
  }

  // Clés Baileys (pre-keys, sessions, sender-keys, app-state-sync-keys)
  const keys = {
    get: async (type, ids) => {
      if (!ids?.length) return {};
      const result = {};
      try {
        const query = {
          accountId: 'main',
          key: { $in: ids.map(id => `key:${type}:${id}`) },
        };
        const docs = await col.find(query).toArray();
        for (const doc of docs) {
          const id = doc.key.split(':').slice(2).join(':');
          result[id] = reviveCreds(doc.value);
        }
      } catch (e) {
        warn(`keys.get: ${e.message}`);
      }
      return result;
    },

    set: async (data) => {
      if (!data) return;
      const now = new Date();
      try {
        const bulkOps = [];
        for (const [type, entries] of Object.entries(data)) {
          if (!entries) continue;
          for (const [id, value] of Object.entries(entries)) {
            const key = `key:${type}:${id}`;
            bulkOps.push({
              updateOne: {
                filter: { accountId: 'main', key },
                update: { $set: { value: credsStringify(value), updatedAt: now }, $setOnInsert: { createdAt: now } },
                upsert: true,
              },
            });
          }
        }
        if (bulkOps.length) await col.bulkWrite(bulkOps, { ordered: false });
      } catch (e) {
        warn(`keys.set: ${e.message}`);
      }
    },
  };

  const saveCreds = async () => {
    if (!creds) return;
    saveToLocal(creds, 'main');
    try {
      const now = new Date();
      await col.updateOne(
        { accountId: 'main', key: 'creds' },
        { $set: { value: credsStringify(creds), updatedAt: now }, $setOnInsert: { createdAt: now } },
        { upsert: true }
      );
    } catch (e) {
      warn(`saveCreds: ${e.message}`);
    }
  };

  return { state: { creds, keys }, saveCreds };
}

/* ══════════════════════════════════════════════════════════════════
   NETTOYAGE — clearMongoSession()
   ══════════════════════════════════════════════════════════════════ */

async function clearMongoSession() {
  try {
    const col = await getCollection(COLLECTIONS.SESSIONS);
    await col.deleteMany({ accountId: 'main' });
    log('Session MongoDB (main) supprimée');
  } catch (e) {
    warn(`clearMongoSession: ${e.message}`);
  }
}

/* ══════════════════════════════════════════════════════════════════
   MULTI-COMPTE — useMongoAuthStateForAccount()
   ══════════════════════════════════════════════════════════════════ */

async function useMongoAuthStateForAccount(accountId) {
  await ensureIndexes();
  const col = await getCollection(COLLECTIONS.SESSIONS);

  let creds = null;
  try {
    const doc = await col.findOne({ accountId, key: 'creds' });
    if (doc?.value) {
      creds = reviveCreds(doc.value);
      log(`Session compte #${accountId} restaurée depuis MongoDB`);
    }
  } catch (e) {
    // MongoDB indisponible → erreur explicite
    const err = new Error(`MONGODB_UNAVAILABLE: impossible de lire les credentials du compte #${accountId} — ${e.message}`);
    err.code = 'MONGODB_UNAVAILABLE';
    throw err;
  }

  if (!creds) {
    const { initAuthCreds } = require('@whiskeysockets/baileys');
    creds = initAuthCreds();
    log(`Nouvelle session compte #${accountId} (pas de credentials existants)`);
  }

  const keys = {
    get: async (type, ids) => {
      if (!ids?.length) return {};
      const result = {};
      try {
        const query = {
          accountId,
          key: { $in: ids.map(id => `key:${type}:${id}`) },
        };
        const docs = await col.find(query).toArray();
        for (const doc of docs) {
          const id = doc.key.split(':').slice(2).join(':');
          result[id] = reviveCreds(doc.value);
        }
      } catch (e) {
        warn(`keys.get #${accountId}: ${e.message}`);
      }
      return result;
    },

    set: async (data) => {
      if (!data) return;
      const now = new Date();
      try {
        const bulkOps = [];
        for (const [type, entries] of Object.entries(data)) {
          if (!entries) continue;
          for (const [id, value] of Object.entries(entries)) {
            const key = `key:${type}:${id}`;
            bulkOps.push({
              updateOne: {
                filter: { accountId, key },
                update: { $set: { value: credsStringify(value), updatedAt: now }, $setOnInsert: { createdAt: now } },
                upsert: true,
              },
            });
          }
        }
        if (bulkOps.length) await col.bulkWrite(bulkOps, { ordered: false });
      } catch (e) {
        warn(`keys.set #${accountId}: ${e.message}`);
      }
    },
  };

  const saveCreds = async () => {
    if (!creds) return;
    saveToLocal(creds, accountId);
    try {
      const now = new Date();
      await col.updateOne(
        { accountId, key: 'creds' },
        { $set: { value: credsStringify(creds), updatedAt: now }, $setOnInsert: { createdAt: now } },
        { upsert: true }
      );
    } catch (e) {
      warn(`saveCreds #${accountId}: ${e.message}`);
    }
  };

  return { state: { creds, keys }, saveCreds };
}

/* ══════════════════════════════════════════════════════════════════
   COMPTES — CRUD sur la collection `accounts`
   ══════════════════════════════════════════════════════════════════ */

async function getAccountDB() {
  await ensureIndexes();
  const col = await getCollection(COLLECTIONS.ACCOUNTS);

  // Wrapper compatible avec l'interface SQL utilisée par account-manager
  return {
    async get(sql, ...params) {
      try {
        const normalized = sql.replace(/\s+/g, ' ').trim();

        // SELECT * FROM wa_accounts WHERE phone = ? → objet unique
        if (/SELECT \* FROM wa_accounts WHERE phone = \?/i.test(normalized)) {
          return await col.findOne({ phone: params[0] }) || null;
        }
        // SELECT * FROM wa_accounts WHERE id = ? → objet unique
        if (/SELECT \* FROM wa_accounts WHERE id = \?/i.test(normalized)) {
          return await col.findOne({ id: params[0] }) || null;
        }
        // SELECT COUNT(*) AS n FROM wa_accounts → { n: number }
        if (/SELECT COUNT\(\*\) AS n FROM wa_accounts/i.test(normalized)) {
          const count = await col.countDocuments();
          return { n: count };
        }
        // Toute autre requête SELECT → premier résultat ou null (get = un seul résultat)
        if (/^SELECT/i.test(normalized)) {
          const docs = await col.find().sort({ created_at: -1 }).limit(1).toArray();
          return docs[0] || null;
        }

        warn(`SQL non supporté: ${normalized}`);
        return null;
      } catch (e) {
        warn(`get error: ${e.message}`);
        return null;
      }
    },

    async all(sql, ...params) {
      try {
        const normalized = sql.replace(/\s+/g, ' ').trim();
        // SELECT * FROM wa_accounts WHERE status = ?
        if (/SELECT \* FROM wa_accounts WHERE status = \?/i.test(normalized)) {
          return await col.find({ status: params[0] }).toArray();
        }
        // SELECT * FROM wa_accounts ORDER BY created_at DESC
        if (/SELECT \* FROM wa_accounts ORDER BY/i.test(normalized)) {
          return await col.find().sort({ created_at: -1 }).toArray();
        }
        // SELECT * FROM wa_accounts
        if (/SELECT \* FROM wa_accounts/i.test(normalized)) {
          return await col.find().sort({ created_at: -1 }).toArray();
        }
        warn(`SQL all non supporté: ${normalized}`);
        return [];
      } catch (e) {
        warn(`all error: ${e.message}`);
        return [];
      }
    },

    async run(sql, ...params) {
      try {
        const normalized = sql.replace(/\s+/g, ' ').trim();
        const now = Date.now();

        // INSERT INTO wa_accounts (id, nom, prenom, phone, status, created_at) VALUES (?, ?, ?, ?, ?, ?)
        if (/INSERT INTO wa_accounts/i.test(normalized)) {
          const doc = {
            id: params[0],
            nom: params[1] || '',
            prenom: params[2] || '',
            phone: params[3],
            status: params[4] || 'pending',
            pairing_code: '',
            pairing_expires_at: 0,
            last_seen: 0,
            created_at: params[5] || now,
          };
          await col.updateOne({ id: doc.id }, { $set: doc }, { upsert: true });
          return { changes: 1 };
        }

        // UPDATE wa_accounts SET pairing_code = ?, pairing_expires_at = ?, status = ? WHERE id = ?
        if (/UPDATE wa_accounts SET pairing_code/i.test(normalized)) {
          await col.updateOne({ id: params[3] }, { $set: {
            pairing_code: params[0] || '',
            pairing_expires_at: params[1] || 0,
            status: params[2] || 'pending',
          }});
          return { changes: 1 };
        }

        // UPDATE wa_accounts SET status = ?, pairing_code = '', pairing_expires_at = 0, last_seen = ? WHERE id = ?
        if (/UPDATE wa_accounts SET status = .* pairing_code = ''/i.test(normalized)) {
          await col.updateOne({ id: params[3] }, { $set: {
            status: params[0],
            pairing_code: '',
            pairing_expires_at: 0,
            last_seen: params[1] || now,
          }});
          return { changes: 1 };
        }

        // UPDATE wa_accounts SET status = ?, pairing_code = '', pairing_expires_at = 0 WHERE id = ?
        if (/UPDATE wa_accounts SET status = .* pairing_expires_at = 0 WHERE/i.test(normalized)) {
          await col.updateOne({ id: params[2] }, { $set: {
            status: params[0],
            pairing_code: '',
            pairing_expires_at: 0,
          }});
          return { changes: 1 };
        }

        // UPDATE wa_accounts SET status = ? WHERE id = ?
        if (/UPDATE wa_accounts SET status = \? WHERE id = \?/i.test(normalized)) {
          await col.updateOne({ id: params[1] }, { $set: { status: params[0] } });
          return { changes: 1 };
        }

        // DELETE FROM wa_accounts WHERE id = ?
        if (/DELETE FROM wa_accounts WHERE id = \?/i.test(normalized)) {
          await col.deleteOne({ id: params[0] });
          return { changes: 1 };
        }

        warn(`SQL run non supporté: ${normalized}`);
        return { changes: 0 };
      } catch (e) {
        warn(`run error: ${e.message}`);
        return { changes: 0 };
      }
    },
  };
}

/** Supprime les clés d'un compte. */
async function clearAccountSession(accountId) {
  try {
    const col = await getCollection(COLLECTIONS.SESSIONS);
    await col.deleteMany({ accountId });
    log(`Session compte #${accountId} supprimée`);
  } catch (e) {
    warn(`clearAccountSession #${accountId}: ${e.message}`);
  }
}

/* ══════════════════════════════════════════════════════════════════
   HEALTH CHECK
   ══════════════════════════════════════════════════════════════════ */

async function healthCheck() {
  try {
    const { checkMongoHealth } = require('./mongodb.cjs');
    return await checkMongoHealth();
  } catch (e) {
    return { status: 'error', error: e.message };
  }
}

module.exports = {
  useMongoAuthState,
  clearMongoSession,
  getAccountDB,
  useMongoAuthStateForAccount,
  clearAccountSession,
  healthCheck,
};
