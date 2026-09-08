import { createLogger } from '../../packages/infrastructure/logger.js';
import { getDB } from '../../packages/infrastructure/database/database.js';

const log = createLogger('DB-TABLES');

const TABLES_PG = {
  contacts_reels: `
    CREATE TABLE IF NOT EXISTS contacts_reels (
      id TEXT PRIMARY KEY, nom TEXT NOT NULL, numero TEXT UNIQUE NOT NULL,
      photoUrl TEXT, presence TEXT, dernierMessage TEXT,
      messagesEchanges BIGINT DEFAULT 0, estBloque BIGINT DEFAULT 0,
      estArchive BIGINT DEFAULT 0, labels TEXT,
      synchroDate TIMESTAMPTZ DEFAULT NOW()
    )`,
  groupes_reels: `
    CREATE TABLE IF NOT EXISTS groupes_reels (
      id TEXT PRIMARY KEY, nom TEXT NOT NULL, description TEXT,
      createur TEXT, participants TEXT, dateCreation TIMESTAMPTZ,
      derniereActivite TIMESTAMPTZ, messagesTotal BIGINT DEFAULT 0,
      estActif BIGINT DEFAULT 1, synchroDate TIMESTAMPTZ DEFAULT NOW()
    )`,
  stats_temps_reel: `
    CREATE TABLE IF NOT EXISTS stats_temps_reel (
      id SERIAL PRIMARY KEY, type TEXT NOT NULL,
      valeur TEXT, dateEnregistrement TIMESTAMPTZ DEFAULT NOW()
    )`,
  diagnostics_history: `
    CREATE TABLE IF NOT EXISTS diagnostics_history (
      id SERIAL PRIMARY KEY, type TEXT NOT NULL,
      statut TEXT NOT NULL, details TEXT,
      dateExecution TIMESTAMPTZ DEFAULT NOW()
    )`,
  /* ═══ Tables RGPD/conformité (src/services/compliance.js) et anti-abus
     (src/services/anomaly-detector.js) — utilisées par du code déjà existant
     mais jamais créées jusqu'ici : les requêtes échouaient avec "no such table". ═══ */
  consentements: `
    CREATE TABLE IF NOT EXISTS consentements (
      id SERIAL PRIMARY KEY, user_jid TEXT NOT NULL, consent_type TEXT NOT NULL,
      consent_given BIGINT DEFAULT 0, consent_date TIMESTAMPTZ, consent_version TEXT,
      expiry_date TIMESTAMPTZ, revocation_date TIMESTAMPTZ, notes TEXT,
      UNIQUE(user_jid, consent_type)
    )`,
  opt_in_tracking: `
    CREATE TABLE IF NOT EXISTS opt_in_tracking (
      id SERIAL PRIMARY KEY, user_jid TEXT NOT NULL, opt_in_type TEXT NOT NULL,
      request_date TIMESTAMPTZ, confirmation_token TEXT, token_expiry TIMESTAMPTZ,
      is_confirmed BIGINT DEFAULT 0, confirmation_date TIMESTAMPTZ,
      UNIQUE(user_jid, opt_in_type)
    )`,
  user_data_requests: `
    CREATE TABLE IF NOT EXISTS user_data_requests (
      id SERIAL PRIMARY KEY, user_jid TEXT NOT NULL, request_type TEXT NOT NULL,
      request_date TIMESTAMPTZ, status TEXT DEFAULT 'pending',
      completion_date TIMESTAMPTZ, data_export_path TEXT
    )`,
  alertes_anomalies: `
    CREATE TABLE IF NOT EXISTS alertes_anomalies (
      id SERIAL PRIMARY KEY, user_jid TEXT NOT NULL, anomaly_type TEXT NOT NULL,
      severity TEXT NOT NULL, description TEXT, detected_at TIMESTAMPTZ, metadata TEXT,
      resolved BIGINT DEFAULT 0, resolved_at TIMESTAMPTZ
    )`,
};

const TABLES_SQLITE = {
  contacts_reels: `
    CREATE TABLE IF NOT EXISTS contacts_reels (
      id TEXT PRIMARY KEY, nom TEXT NOT NULL, numero TEXT UNIQUE NOT NULL,
      photoUrl TEXT, presence TEXT, dernierMessage TEXT,
      messagesEchanges INTEGER DEFAULT 0, estBloque INTEGER DEFAULT 0,
      estArchive INTEGER DEFAULT 0, labels TEXT,
      synchroDate DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  groupes_reels: `
    CREATE TABLE IF NOT EXISTS groupes_reels (
      id TEXT PRIMARY KEY, nom TEXT NOT NULL, description TEXT,
      createur TEXT, participants TEXT, dateCreation DATETIME,
      derniereActivite DATETIME, messagesTotal INTEGER DEFAULT 0,
      estActif INTEGER DEFAULT 1, synchroDate DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  stats_temps_reel: `
    CREATE TABLE IF NOT EXISTS stats_temps_reel (
      id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL,
      valeur TEXT, dateEnregistrement DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  diagnostics_history: `
    CREATE TABLE IF NOT EXISTS diagnostics_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL,
      statut TEXT NOT NULL, details TEXT,
      dateExecution DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  consentements: `
    CREATE TABLE IF NOT EXISTS consentements (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_jid TEXT NOT NULL, consent_type TEXT NOT NULL,
      consent_given INTEGER DEFAULT 0, consent_date DATETIME, consent_version TEXT,
      expiry_date DATETIME, revocation_date DATETIME, notes TEXT,
      UNIQUE(user_jid, consent_type)
    )`,
  opt_in_tracking: `
    CREATE TABLE IF NOT EXISTS opt_in_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_jid TEXT NOT NULL, opt_in_type TEXT NOT NULL,
      request_date DATETIME, confirmation_token TEXT, token_expiry DATETIME,
      is_confirmed INTEGER DEFAULT 0, confirmation_date DATETIME,
      UNIQUE(user_jid, opt_in_type)
    )`,
  user_data_requests: `
    CREATE TABLE IF NOT EXISTS user_data_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_jid TEXT NOT NULL, request_type TEXT NOT NULL,
      request_date DATETIME, status TEXT DEFAULT 'pending',
      completion_date DATETIME, data_export_path TEXT
    )`,
  alertes_anomalies: `
    CREATE TABLE IF NOT EXISTS alertes_anomalies (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_jid TEXT NOT NULL, anomaly_type TEXT NOT NULL,
      severity TEXT NOT NULL, description TEXT, detected_at DATETIME, metadata TEXT,
      resolved INTEGER DEFAULT 0, resolved_at DATETIME
    )`,
};

export async function createAllTables() {
  let db;
  try { db = getDB(); } catch { db = null; }
  if (!db) return { created: 0, total: 0, ok: false, reason: 'DB indisponible' };

  const isPostgres = !!(db._pool || db._pg || db._postgres);
  const tables = isPostgres ? TABLES_PG : TABLES_SQLITE;
  const names = Object.keys(tables);
  let created = 0;

  log.info(`Création des tables temps réel (${isPostgres ? 'PostgreSQL' : 'SQLite'})...`);
  for (const name of names) {
    try {
      await db.run(tables[name]);
      created++;
    } catch (e) {
      log.warn(`Table ${name} non créée: ${e.message}`);
    }
  }
  log.info(`Tables prêtes: ${created}/${names.length}`);
  return { created, total: names.length, ok: created === names.length };
}
