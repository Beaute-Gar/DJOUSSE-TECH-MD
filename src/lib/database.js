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
    jid        TEXT PRIMARY KEY,
    money      INTEGER NOT NULL DEFAULT 0,
    bank       INTEGER NOT NULL DEFAULT 0,
    last_daily INTEGER NOT NULL DEFAULT 0
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
  CREATE TABLE IF NOT EXISTS cognitive_persons (
    id          TEXT PRIMARY KEY,
    jid         TEXT UNIQUE NOT NULL,
    number      TEXT,
    name        TEXT NOT NULL DEFAULT 'Inconnu',
    type        TEXT NOT NULL DEFAULT 'individual',
    frequency   INTEGER NOT NULL DEFAULT 0,
    trust_level INTEGER NOT NULL DEFAULT 1,
    first_seen  INTEGER NOT NULL,
    last_seen   INTEGER NOT NULL,
    metadata    TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS cognitive_relations (
    id          TEXT PRIMARY KEY,
    source_jid  TEXT NOT NULL,
    target_jid  TEXT NOT NULL,
    type        TEXT NOT NULL,
    properties  TEXT NOT NULL DEFAULT '{}',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cognitive_nodes (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL,
    properties  TEXT NOT NULL DEFAULT '{}',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cognitive_edges (
    id          TEXT PRIMARY KEY,
    source_id   TEXT NOT NULL,
    target_id   TEXT NOT NULL,
    type        TEXT NOT NULL,
    properties  TEXT NOT NULL DEFAULT '{}',
    weight      INTEGER NOT NULL DEFAULT 1,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cognitive_memories (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    jid           TEXT NOT NULL,
    type          TEXT NOT NULL,
    content       TEXT NOT NULL,
    embedding     TEXT,
    created_at    INTEGER NOT NULL,
    last_accessed INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cognitive_twins (
    jid         TEXT PRIMARY KEY,
    profile     TEXT NOT NULL DEFAULT '{}',
    habits      TEXT NOT NULL DEFAULT '{}',
    scores      TEXT NOT NULL DEFAULT '{}',
    predictions TEXT NOT NULL DEFAULT '{}',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cognitive_goals (
    id          TEXT PRIMARY KEY,
    jid         TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    type        TEXT NOT NULL DEFAULT 'personal',
    status      TEXT NOT NULL DEFAULT 'active',
    priority    INTEGER NOT NULL DEFAULT 3,
    deadline    INTEGER,
    parent_id   TEXT DEFAULT '',
    tags        TEXT NOT NULL DEFAULT '[]',
    metadata    TEXT NOT NULL DEFAULT '{}',
    completed_at INTEGER,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cognitive_meta (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_id     TEXT NOT NULL,
    goal         TEXT,
    confidence   REAL,
    action       TEXT,
    outcome      TEXT,
    was_correct  INTEGER,
    user_feedback TEXT,
    latency      INTEGER,
    created_at   INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_cognitive_goals_jid ON cognitive_goals(jid);
  CREATE INDEX IF NOT EXISTS idx_cognitive_goals_status ON cognitive_goals(status);
  CREATE INDEX IF NOT EXISTS idx_cognitive_meta_trace ON cognitive_meta(trace_id);
  CREATE TABLE IF NOT EXISTS cognitive_actions (
    id          TEXT PRIMARY KEY,
    jid         TEXT NOT NULL,
    type        TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    due_at      INTEGER NOT NULL,
    priority    INTEGER NOT NULL DEFAULT 0,
    related_to  TEXT,
    metadata    TEXT NOT NULL DEFAULT '{}',
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  INTEGER NOT NULL,
    completed_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_cognitive_actions_jid ON cognitive_actions(jid);
  CREATE INDEX IF NOT EXISTS idx_cognitive_actions_status ON cognitive_actions(status);
  CREATE INDEX IF NOT EXISTS idx_cognitive_persons_jid ON cognitive_persons(jid);
  CREATE INDEX IF NOT EXISTS idx_cognitive_persons_freq ON cognitive_persons(frequency DESC);
  CREATE INDEX IF NOT EXISTS idx_cognitive_rels_source ON cognitive_relations(source_jid);
  CREATE INDEX IF NOT EXISTS idx_cognitive_nodes_type ON cognitive_nodes(type);
  CREATE INDEX IF NOT EXISTS idx_cognitive_edges_source ON cognitive_edges(source_id);
  CREATE INDEX IF NOT EXISTS idx_cognitive_edges_target ON cognitive_edges(target_id);
  CREATE INDEX IF NOT EXISTS idx_cognitive_memories_jid ON cognitive_memories(jid);
  CREATE INDEX IF NOT EXISTS idx_cognitive_memories_type ON cognitive_memories(type);
  CREATE INDEX IF NOT EXISTS idx_warns_jid_group    ON warns(jid, group_jid);
  CREATE INDEX IF NOT EXISTS idx_antidelete_chat    ON antidelete_buffer(chat_jid);
  CREATE INDEX IF NOT EXISTS idx_antidelete_created ON antidelete_buffer(created_at);
  CREATE INDEX IF NOT EXISTS idx_roblox_conv_chat   ON roblox_conv_memory(chat_jid);
  CREATE INDEX IF NOT EXISTS idx_mg_posted_group    ON mg_posted(group_jid);
  CREATE INDEX IF NOT EXISTS idx_mg_conv_group      ON mg_conv_memory(group_jid);

  CREATE TABLE IF NOT EXISTS cognitive_missions (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    owner         TEXT,
    status        TEXT NOT NULL DEFAULT 'draft',
    priority      INTEGER NOT NULL DEFAULT 3,
    tags          TEXT NOT NULL DEFAULT '[]',
    metadata      TEXT NOT NULL DEFAULT '{}',
    objectives    TEXT NOT NULL DEFAULT '[]',
    tasks         TEXT NOT NULL DEFAULT '[]',
    dependencies  TEXT NOT NULL DEFAULT '[]',
    resources     TEXT NOT NULL DEFAULT '[]',
    timeline      TEXT NOT NULL DEFAULT '{}',
    participants  TEXT NOT NULL DEFAULT '[]',
    progress      INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    completed_at  INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_missions_status ON cognitive_missions(status);
  CREATE INDEX IF NOT EXISTS idx_missions_owner ON cognitive_missions(owner);
  CREATE INDEX IF NOT EXISTS idx_missions_priority ON cognitive_missions(priority);

  CREATE TABLE IF NOT EXISTS cognitive_history (
    id          TEXT PRIMARY KEY,
    mission_id  TEXT NOT NULL,
    reason      TEXT NOT NULL DEFAULT 'auto',
    state       TEXT NOT NULL DEFAULT '{}',
    created_at  INTEGER NOT NULL,
    FOREIGN KEY (mission_id) REFERENCES cognitive_missions(id)
  );
  CREATE INDEX IF NOT EXISTS idx_history_mission ON cognitive_history(mission_id);
  CREATE INDEX IF NOT EXISTS idx_history_created ON cognitive_history(created_at);

  CREATE TABLE IF NOT EXISTS cognitive_futures (
    id            TEXT PRIMARY KEY,
    label         TEXT NOT NULL,
    parent_id     TEXT,
    probability   REAL NOT NULL DEFAULT 0.5,
    hypotheses    TEXT NOT NULL DEFAULT '[]',
    risks         TEXT NOT NULL DEFAULT '[]',
    resources     TEXT NOT NULL DEFAULT '{}',
    trigger_events TEXT NOT NULL DEFAULT '[]',
    signals       TEXT NOT NULL DEFAULT '[]',
    metadata      TEXT NOT NULL DEFAULT '{}',
    created_at    INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_futures_parent ON cognitive_futures(parent_id);
  CREATE INDEX IF NOT EXISTS idx_futures_prob ON cognitive_futures(probability);

  CREATE TABLE IF NOT EXISTS cognitive_decisions (
    id                TEXT PRIMARY KEY,
    context           TEXT NOT NULL,
    scenarios         TEXT NOT NULL DEFAULT '[]',
    chosen_id         TEXT,
    reasons           TEXT NOT NULL DEFAULT '[]',
    predicted_outcome TEXT,
    actual_outcome    TEXT,
    outcome_collected_at INTEGER,
    accuracy          INTEGER,
    metadata          TEXT NOT NULL DEFAULT '{}',
    created_at        INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_decisions_created ON cognitive_decisions(created_at);
  CREATE INDEX IF NOT EXISTS idx_decisions_accuracy ON cognitive_decisions(accuracy);

  CREATE TABLE IF NOT EXISTS cognitive_episodes (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    source      TEXT NOT NULL DEFAULT '',
    entities    TEXT NOT NULL DEFAULT '[]',
    metadata    TEXT NOT NULL DEFAULT '{}',
    start_at    INTEGER NOT NULL,
    end_at      INTEGER,
    created_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_episodes_type ON cognitive_episodes(type);
  CREATE INDEX IF NOT EXISTS idx_episodes_source ON cognitive_episodes(source);
  CREATE INDEX IF NOT EXISTS idx_episodes_created ON cognitive_episodes(created_at);

  CREATE TABLE IF NOT EXISTS cognitive_concepts (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'auto',
    aliases     TEXT NOT NULL DEFAULT '[]',
    strength    INTEGER NOT NULL DEFAULT 1,
    metadata    TEXT NOT NULL DEFAULT '{}',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_concepts_type ON cognitive_concepts(type);
  CREATE INDEX IF NOT EXISTS idx_concepts_strength ON cognitive_concepts(strength);

  CREATE TABLE IF NOT EXISTS cognitive_relationship_history (
    id          TEXT PRIMARY KEY,
    source_jid  TEXT NOT NULL,
    target_jid  TEXT NOT NULL,
    type        TEXT NOT NULL,
    strength    INTEGER NOT NULL DEFAULT 1,
    context     TEXT,
    recorded_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_relhist_source ON cognitive_relationship_history(source_jid);
  CREATE INDEX IF NOT EXISTS idx_relhist_target ON cognitive_relationship_history(target_jid);
  CREATE INDEX IF NOT EXISTS idx_relhist_recorded ON cognitive_relationship_history(recorded_at);

  CREATE TABLE IF NOT EXISTS cognitive_reasoning_memory (
    id          TEXT PRIMARY KEY,
    context     TEXT NOT NULL DEFAULT '{}',
    rules_used  TEXT NOT NULL DEFAULT '[]',
    trace       TEXT NOT NULL DEFAULT '{}',
    outcome     TEXT,
    accuracy    INTEGER,
    created_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_reasoning_created ON cognitive_reasoning_memory(created_at);
  CREATE INDEX IF NOT EXISTS idx_reasoning_accuracy ON cognitive_reasoning_memory(accuracy);

  CREATE TABLE IF NOT EXISTS cognitive_mission_memory (
    id                TEXT PRIMARY KEY,
    source_mission_id TEXT NOT NULL,
    target_mission_id TEXT NOT NULL,
    link_type         TEXT NOT NULL,
    metadata          TEXT NOT NULL DEFAULT '{}',
    created_at        INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_mm_source ON cognitive_mission_memory(source_mission_id);
  CREATE INDEX IF NOT EXISTS idx_mm_target ON cognitive_mission_memory(target_mission_id);

  CREATE TABLE IF NOT EXISTS cognitive_timeline (
    id          TEXT PRIMARY KEY,
    source_type TEXT NOT NULL,
    source_id   TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    timestamp   INTEGER NOT NULL,
    tags        TEXT NOT NULL DEFAULT '[]',
    metadata    TEXT NOT NULL DEFAULT '{}',
    created_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_timeline_source ON cognitive_timeline(source_type, source_id);
  CREATE INDEX IF NOT EXISTS idx_timeline_ts ON cognitive_timeline(timestamp);
  CREATE INDEX IF NOT EXISTS idx_timeline_tags ON cognitive_timeline(tags);

  CREATE TABLE IF NOT EXISTS cognitive_context_store (
    jid         TEXT NOT NULL,
    key         TEXT NOT NULL,
    value       TEXT NOT NULL DEFAULT '{}',
    context     TEXT NOT NULL DEFAULT '{}',
    updated_at  INTEGER NOT NULL,
    PRIMARY KEY (jid, key)
  );

  CREATE TABLE IF NOT EXISTS cognitive_knowledge_mesh (
    id          TEXT PRIMARY KEY,
    source_type TEXT NOT NULL,
    source_id   TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id   TEXT NOT NULL,
    relation    TEXT NOT NULL,
    weight      REAL NOT NULL DEFAULT 1,
    context     TEXT,
    created_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_mesh_source ON cognitive_knowledge_mesh(source_type, source_id);
  CREATE INDEX IF NOT EXISTS idx_mesh_target ON cognitive_knowledge_mesh(target_type, target_id);
  CREATE INDEX IF NOT EXISTS idx_mesh_relation ON cognitive_knowledge_mesh(relation);

  CREATE TABLE IF NOT EXISTS cognitive_cache (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    expires_at  INTEGER NOT NULL,
    hits        INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_cache_expires ON cognitive_cache(expires_at);

  CREATE TABLE IF NOT EXISTS cognitive_objects (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL,
    content     TEXT,
    mime_type   TEXT,
    source      TEXT,
    author      TEXT,
    entities    TEXT NOT NULL DEFAULT '[]',
    concepts    TEXT NOT NULL DEFAULT '[]',
    relations   TEXT NOT NULL DEFAULT '[]',
    summary     TEXT NOT NULL DEFAULT '',
    tags        TEXT NOT NULL DEFAULT '[]',
    metadata    TEXT NOT NULL DEFAULT '{}',
    pipeline    TEXT NOT NULL DEFAULT '[]',
    created_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_objects_type ON cognitive_objects(type);
  CREATE INDEX IF NOT EXISTS idx_objects_source ON cognitive_objects(source);
  CREATE INDEX IF NOT EXISTS idx_objects_created ON cognitive_objects(created_at);
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
  if (!db) { log.warn('DB pas encore initialisee, operation differee'); return null; }
  try {
    return db.prepare(sql);
  } catch {
    _save();
    return db ? db.prepare(sql) : null;
  }
}

function _get(sql, ...params) {
  const stmt = _p(sql);
  if (!stmt) return null;
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
  if (!stmt) return [];
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
  if (!db) return;
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

/* ── Wrappers ─────────────────────────────────────────────── */
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

/* ── Wrappers middleware ──────────────────────────────────── */
export function upsertUser(jid, name) { Users.upsert(jid, name); }
export function upsertGroup(jid, name) { Groups.upsert(jid, name); }
export function addXP(jid, amount) { Users.addXP(jid, amount); }
export function getGroup(jid) { return Groups.get(jid); }
export function isGroupAllowed(jid) { return !isGroupBanned(jid); }

export function logMessage(senderJid, groupJid, intent, content) {
  try {
    _run('INSERT INTO cmd_stats (cmd_name, count) VALUES (?, 1) ON CONFLICT(cmd_name) DO UPDATE SET count = count + 1', intent + ':' + (content?.substring(0, 50) || ''));
  } catch {}
}

/* ── Economy ────────────────────────────────────────────────── */
export function ensureEconomy(jid) {
  const exists = _get('SELECT 1 FROM economy WHERE jid = ?', jid);
  if (!exists) _run('INSERT INTO economy (jid, money, bank) VALUES (?, 0, 0)', jid);
}
export function getEconomy(jid) {
  return _get('SELECT money, bank, last_daily FROM economy WHERE jid = ?', jid) || { money: 0, bank: 0, last_daily: 0 };
}
export function transferCoins(from, to, amount) {
  const sender = _get('SELECT money FROM economy WHERE jid = ?', from);
  if (!sender || sender.money < amount) throw new Error('Solde insuffisant');
  _run('UPDATE economy SET money = money - ? WHERE jid = ?', amount, from);
  _run('INSERT INTO economy (jid, money) VALUES (?, ?) ON CONFLICT(jid) DO UPDATE SET money = money + ?', to, amount, amount);
}
export function setLastDaily(jid, ts) {
  _run('UPDATE economy SET last_daily = ? WHERE jid = ?', ts, jid);
}
export function getRichList(limit = 10) {
  return _all('SELECT jid, money, bank, (money + bank) as total FROM economy ORDER BY total DESC LIMIT ?', limit);
}
