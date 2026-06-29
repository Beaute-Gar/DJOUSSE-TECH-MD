import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config  = require('../../config.cjs');
import { createLogger } from '../core/logger.js';
const log = createLogger('DATABASE');

let db = null;
const DB_FILE = path.resolve(config.DB_PATH || './data/djousse.db');
const DB_DIR = path.dirname(DB_FILE);

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    jid         TEXT PRIMARY KEY,
    name        TEXT,
    xp          INTEGER NOT NULL DEFAULT 0,
    level       INTEGER NOT NULL DEFAULT 1,
    balance     INTEGER NOT NULL DEFAULT 0,
    is_premium  INTEGER NOT NULL DEFAULT 0,
    is_banned   INTEGER NOT NULL DEFAULT 0,
    ban_reason  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS groups (
    jid           TEXT PRIMARY KEY,
    name          TEXT,
    is_banned     INTEGER NOT NULL DEFAULT 0,
    antilink      INTEGER NOT NULL DEFAULT 0,
    antibot       INTEGER NOT NULL DEFAULT 0,
    antidelete    INTEGER NOT NULL DEFAULT 0,
    only_admin    INTEGER NOT NULL DEFAULT 0,
    welcome       INTEGER NOT NULL DEFAULT 0,
    welcome_msg   TEXT,
    goodbye_msg   TEXT,
    hentai_block  INTEGER NOT NULL DEFAULT 0,
    botban        INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS warns (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    jid         TEXT NOT NULL,
    group_jid   TEXT NOT NULL,
    reason      TEXT,
    warned_by   TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sudo (
    jid         TEXT PRIMARY KEY,
    added_by    TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS cron_tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    group_jid   TEXT NOT NULL,
    message     TEXT NOT NULL,
    schedule    TEXT NOT NULL,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_by  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS antidelete_buffer (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id    TEXT NOT NULL UNIQUE,
    chat_jid      TEXT NOT NULL,
    sender_jid    TEXT NOT NULL,
    message_type  TEXT NOT NULL,
    content       TEXT,
    media_path    TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS economy (
    jid   TEXT PRIMARY KEY,
    money INTEGER NOT NULL DEFAULT 0,
    bank  INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS cmd_stats (
    cmd_name  TEXT PRIMARY KEY,
    count     INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS user_sessions (
    jid         TEXT PRIMARY KEY,
    daily_date  TEXT,
    robux       INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS banned_groups (
    jid TEXT PRIMARY KEY
  );
  CREATE TABLE IF NOT EXISTS roblox_posted (
    game_id    TEXT PRIMARY KEY,
    posted_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS roblox_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS roblox_conv_memory (
    chat_jid   TEXT NOT NULL,
    role       TEXT NOT NULL,
    content    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS mg_groups (
    jid         TEXT PRIMARY KEY,
    profile_key TEXT NOT NULL,
    group_name  TEXT,
    enabled     INTEGER NOT NULL DEFAULT 1,
    registered_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS mg_posted (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    group_jid   TEXT NOT NULL,
    content_key TEXT NOT NULL,
    posted_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS mg_conv_memory (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    group_jid  TEXT NOT NULL,
    role       TEXT NOT NULL,
    content    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_warns_jid_group    ON warns(jid, group_jid);
  CREATE INDEX IF NOT EXISTS idx_antidelete_chat    ON antidelete_buffer(chat_jid);
  CREATE INDEX IF NOT EXISTS idx_antidelete_created ON antidelete_buffer(created_at);
  CREATE INDEX IF NOT EXISTS idx_roblox_conv_chat   ON roblox_conv_memory(chat_jid);
  CREATE INDEX IF NOT EXISTS idx_mg_posted_group    ON mg_posted(group_jid);
  CREATE INDEX IF NOT EXISTS idx_mg_conv_group      ON mg_conv_memory(group_jid);
`;

export async function initDB() {
  if (db) return db;
  try {
    if (config.DB_TYPE === 'postgres' && config.DATABASE_URL) {
      return await _initPostgres();
    }
    return await _initSQLite();
  } catch (err) {
    log.error({ err }, 'Échec initialisation DB');
    throw err;
  }
}

async function _initSQLite() {
  const initSqlJs = (await import('sql.js')).default;
  const SQL = await initSqlJs();

  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  let loaded = false;
  if (existsSync(DB_FILE)) {
    try {
      const buf = readFileSync(DB_FILE);
      db = new SQL.Database(buf);
      loaded = true;
    } catch { db = new SQL.Database(); }
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');
  db.run(SCHEMA);

  log.info(`SQLite initialisé : ${DB_FILE}`);
  _save();
  return db;
}

async function _initPostgres() {
  const { default: pg } = await import('pg');
  const { Pool } = pg;
  const pool = new Pool({ connectionString: config.DATABASE_URL, max: 10 });
  const client = await pool.connect();
  log.info('PostgreSQL connecté');
  const pgSchema = SCHEMA
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
    .replace(/TEXT NOT NULL DEFAULT \(datetime\('now'\)\)/g, "TIMESTAMPTZ NOT NULL DEFAULT NOW()")
    .replace(/datetime\('now', '-24 hours'\)/g, "NOW() - INTERVAL '24 hours'");
  await client.query(pgSchema);
  client.release();
  db = {
    _pool: pool,
    run:  (sql, ...p) => pool.query(sql, p),
    get:  (sql, ...p) => pool.query(sql, p).then(r => r.rows[0] ?? null),
    all:  (sql, ...p) => pool.query(sql, p).then(r => r.rows),
    exec: (sql) => pool.query(sql),
    close: () => pool.end(),
  };
  return db;
}

function _save() {
  if (!db || config.DB_TYPE === 'postgres') return;
  try {
    const data = db.export();
    const buf = Buffer.from(data);
    writeFileSync(DB_FILE, buf);
  } catch (e) {
    log.error(`_save: ${e.message}`);
  }
}

function _p(sql) {
  try {
    return db.prepare(sql);
  } catch {
    _save();
    return db.prepare(sql);
  }
}

function _get(sql, ...params) {
  const stmt = _p(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    stmt.free();
    const obj = {};
    for (let i = 0; i < cols.length; i++) obj[cols[i]] = vals[i];
    return obj;
  }
  stmt.free();
  return null;
}

function _all(sql, ...params) {
  const stmt = _p(sql);
  stmt.bind(params);
  const cols = stmt.getColumnNames();
  const rows = [];
  while (stmt.step()) {
    const vals = stmt.get();
    const obj = {};
    for (let i = 0; i < cols.length; i++) obj[cols[i]] = vals[i];
    rows.push(obj);
  }
  stmt.free();
  return rows;
}

function _run(sql, ...params) {
  try {
    db.run(sql, params);
    _save();
  } catch (e) { log.error(`_run: ${e.message}`); }
}

export function getDB() {
  if (!db) throw new Error('[DB] getDB() appelé avant initDB()');
  return db;
}

export function closeDB() {
  try { _save(); db?.close?.(); } catch {}
}

export const Users = {
  get: (jid) => _get('SELECT * FROM users WHERE jid = ?', jid),
  upsert: (jid, name) => _run('INSERT INTO users (jid, name) VALUES (?, ?) ON CONFLICT(jid) DO UPDATE SET name = excluded.name, updated_at = datetime(\'now\')', jid, name),
  addXP: (jid, amount) => _run('UPDATE users SET xp = xp + ?, updated_at = datetime(\'now\') WHERE jid = ?', amount, jid),
  ban: (jid, reason = '') => _run('UPDATE users SET is_banned = 1, ban_reason = ?, updated_at = datetime(\'now\') WHERE jid = ?', reason, jid),
  unban: (jid) => _run('UPDATE users SET is_banned = 0, ban_reason = NULL, updated_at = datetime(\'now\') WHERE jid = ?', jid),
  isBanned: (jid) => { const u = _get('SELECT is_banned FROM users WHERE jid = ?', jid); return u?.is_banned === 1; },
  setPremium: (jid, val) => _run('UPDATE users SET is_premium = ?, updated_at = datetime(\'now\') WHERE jid = ?', val ? 1 : 0, jid),
  leaderboard: (limit = 10) => _all('SELECT jid, name, xp, level FROM users ORDER BY xp DESC LIMIT ?', limit),
};

export const Groups = {
  get: (jid) => _get('SELECT * FROM groups WHERE jid = ?', jid),
  upsert: (jid, name) => _run('INSERT INTO groups (jid, name) VALUES (?, ?) ON CONFLICT(jid) DO UPDATE SET name = excluded.name, updated_at = datetime(\'now\')', jid, name),
  setSetting: (jid, key, val) => {
    const ALLOWED = ['antilink','antibot','antidelete','only_admin','welcome','hentai_block','is_banned','botban'];
    if (!ALLOWED.includes(key)) throw new Error(`Clé groupe inconnue : ${key}`);
    _run(`UPDATE groups SET ${key} = ?, updated_at = datetime('now') WHERE jid = ?`, val ? 1 : 0, jid);
  },
  setWelcomeMsg: (jid, msg) => _run('UPDATE groups SET welcome_msg = ?, updated_at = datetime(\'now\') WHERE jid = ?', msg, jid),
  setGoodbyeMsg: (jid, msg) => _run('UPDATE groups SET goodbye_msg = ?, updated_at = datetime(\'now\') WHERE jid = ?', msg, jid),
};

export const Warns = {
  add: (jid, groupJid, reason, warnedBy) => _run('INSERT INTO warns (jid, group_jid, reason, warned_by) VALUES (?, ?, ?, ?)', jid, groupJid, reason, warnedBy),
  count: (jid, groupJid) => { const r = _get('SELECT COUNT(*) as n FROM warns WHERE jid = ? AND group_jid = ?', jid, groupJid); return r?.n ?? 0; },
  reset: (jid, groupJid) => _run('DELETE FROM warns WHERE jid = ? AND group_jid = ?', jid, groupJid),
  list: (jid, groupJid) => _all('SELECT * FROM warns WHERE jid = ? AND group_jid = ? ORDER BY created_at DESC', jid, groupJid),
};

export const Sudo = {
  add: (jid, addedBy) => _run('INSERT OR IGNORE INTO sudo (jid, added_by) VALUES (?, ?)', jid, addedBy),
  remove: (jid) => _run('DELETE FROM sudo WHERE jid = ?', jid),
  list: () => _all('SELECT jid FROM sudo').map(r => r.jid),
  isSudo: (jid) => { const r = _get('SELECT 1 FROM sudo WHERE jid = ?', jid); return !!r; },
};

export const AntiDelete = {
  save: (messageId, chatJid, senderJid, type, content, mediaPath = null) => {
    try { _run('INSERT OR REPLACE INTO antidelete_buffer (message_id, chat_jid, sender_jid, message_type, content, media_path) VALUES (?, ?, ?, ?, ?, ?)', messageId, chatJid, senderJid, type, content, mediaPath); } catch {}
  },
  get: (messageId) => _get('SELECT * FROM antidelete_buffer WHERE message_id = ?', messageId),
  cleanup: () => _run("DELETE FROM antidelete_buffer WHERE created_at < datetime('now', '-24 hours')"),
};

export const Cron = {
  add: (groupJid, message, schedule, createdBy) => _run('INSERT INTO cron_tasks (group_jid, message, schedule, created_by) VALUES (?, ?, ?, ?)', groupJid, message, schedule, createdBy),
  remove: (id) => _run('DELETE FROM cron_tasks WHERE id = ?', id),
  listActive: () => _all('SELECT * FROM cron_tasks WHERE is_active = 1'),
  listForGroup: (groupJid) => _all('SELECT * FROM cron_tasks WHERE group_jid = ? AND is_active = 1', groupJid),
};

export const rawRun = _run;
export const rawGet = _get;
export const rawAll = _all;

export function getSetting(key) {
  try { const r = _get('SELECT value FROM roblox_settings WHERE key=?', key); return r?.value ?? null; } catch { return null; }
}

export function updateSetting(key, value) {
  try { _run('INSERT OR REPLACE INTO roblox_settings (key,value) VALUES (?,?)', key, String(value)); } catch {}
}

export function ensureUser(jid, name) { Users.upsert(jid, name); return Users.get(jid); }
export function ensureGroup(chat) { Groups.upsert(chat, ''); return Groups.get(chat); }
export function addXp(jid, amount) { Users.addXP(jid, amount); }
export function getUserLevel(jid) { return Users.get(jid) || { level: 0, xp: 0 }; }
export function isBanned(jid) { return Users.isBanned(jid); }
export function isGroupBanned(chat) { const g = Groups.get(chat); return g?.is_banned === 1; }
export function addCoins(jid, amount) { _run('INSERT INTO economy (jid, money) VALUES (?, ?) ON CONFLICT(jid) DO UPDATE SET money = money + ?', jid, amount, amount); }
export function removeCoins(jid, amount) { _run('INSERT INTO economy (jid, money) VALUES (?, 0) ON CONFLICT(jid) DO UPDATE SET money = MAX(0, money - ?)', jid, amount); }
export function getBalance(jid) { return _get('SELECT money, bank FROM economy WHERE jid = ?', jid) || { money: 0, bank: 0 }; }
export function incrementCmd(cmd) { _run('INSERT INTO cmd_stats (cmd_name, count) VALUES (?, 1) ON CONFLICT(cmd_name) DO UPDATE SET count = count + 1', cmd); }
export function getCmdStats(cmd) { const r = _get('SELECT count FROM cmd_stats WHERE cmd_name = ?', cmd); return r?.count || 0; }
export function addRobux(jid, amount) { _run('INSERT INTO user_sessions (jid, robux) VALUES (?, ?) ON CONFLICT(jid) DO UPDATE SET robux = robux + ?', jid, amount, amount); }
export function setDaily(jid, date) { _run('INSERT INTO user_sessions (jid, daily_date) VALUES (?, ?) ON CONFLICT(jid) DO UPDATE SET daily_date = ?', jid, date, date); }
export function getDaily(jid) { const r = _get('SELECT daily_date FROM user_sessions WHERE jid = ?', jid); return r?.daily_date || null; }
