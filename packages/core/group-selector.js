import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../../config.cjs');
import { createLogger } from '../infrastructure/logger.js';
const log = createLogger('SELECTOR');

let _db = null;
let _cache = null;
let _lastFetch = 0;
const CACHE_TTL = 10000;

async function _getDB() {
  if (_db) return _db;
  const { initDB } = await import('../infrastructure/database/database.js');
  _db = await initDB();
  return _db;
}

function _invalidateCache() {
  _cache = null;
  _lastFetch = 0;
}

async function _loadConfig() {
  const now = Date.now();
  if (_cache && now - _lastFetch < CACHE_TTL) return _cache;
  const db = await _getDB();
  const rows = await db.all('SELECT jid, type, name, icon, member_count, is_allowed, mode FROM allowed_chats').catch(() => []);
  const groups = new Set();
  const chats = new Set();
  let mode = 'none';
  for (const r of rows) {
    if (r.is_allowed) {
      if (r.type === 'group') groups.add(r.jid);
      else chats.add(r.jid);
    }
    if (r.mode === 'all' || r.mode === 'selected' || r.mode === 'none') mode = r.mode;
  }
  _cache = { groups, chats, mode, rows, count: groups.size + chats.size };
  _lastFetch = now;
  return _cache;
}

export const GroupSelector = {
  async init() {
    const db = await _getDB();
    await db.run(`
      CREATE TABLE IF NOT EXISTS allowed_chats (
        jid TEXT PRIMARY KEY,
        type TEXT NOT NULL DEFAULT 'group',
        name TEXT,
        icon TEXT DEFAULT '💬',
        member_count INTEGER DEFAULT 0,
        is_allowed INTEGER NOT NULL DEFAULT 0,
        mode TEXT NOT NULL DEFAULT 'none',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).catch(() => {});
    _invalidateCache();
    log.info('GroupSelector initialisé (mode silencieux par defaut)');
  },

  canRespond(jid) {
    if (!jid) return false;
    const isGroup = jid.endsWith('@g.us');
    const cfg = _cache;
    if (!cfg) return false;
    if (cfg.mode === 'all') return true;
    if (cfg.mode === 'none') return false;
    if (isGroup) return cfg.groups.has(jid);
    return cfg.chats.has(jid);
  },

  canModerate(jid) { return this.canRespond(jid); },
  canPublish(jid) { return this.canRespond(jid); },
  canWelcome(jid) { return this.canRespond(jid); },

  getMode() { return _cache?.mode || 'none'; },

  async setMode(mode) {
    if (!['all', 'selected', 'none'].includes(mode)) return;
    const db = await _getDB();
    await db.run("UPDATE allowed_chats SET mode = ? WHERE jid = 'global'", mode).catch(() => {});
    await db.run("INSERT OR REPLACE INTO allowed_chats (jid, type, mode, is_allowed) VALUES ('global', 'config', ?, 0)", mode).catch(() => {});
    _invalidateCache();
  },

  async toggle(jid, type = 'group') {
    const db = await _getDB();
    const existing = await db.get('SELECT is_allowed FROM allowed_chats WHERE jid = ?', jid).catch(() => null);
    const newVal = existing ? (existing.is_allowed ? 0 : 1) : 1;
    await db.run(
      "INSERT INTO allowed_chats (jid, type, is_allowed, mode) VALUES (?, ?, ?, 'selected') ON CONFLICT(jid) DO UPDATE SET is_allowed = ?, updated_at = datetime('now')",
      jid, type, newVal, newVal
    ).catch(() => {});
    _invalidateCache();
    return !!newVal;
  },

  async allow(jid, type = 'group') {
    const db = await _getDB();
    await db.run(
      "INSERT INTO allowed_chats (jid, type, is_allowed, mode) VALUES (?, ?, 1, 'selected') ON CONFLICT(jid) DO UPDATE SET is_allowed = 1, updated_at = datetime('now')",
      jid, type
    ).catch(() => {});
    _invalidateCache();
  },

  async deny(jid) {
    const db = await _getDB();
    await db.run("UPDATE allowed_chats SET is_allowed = 0, updated_at = datetime('now') WHERE jid = ?", jid).catch(() => {});
    _invalidateCache();
  },

  async remove(jid) {
    const db = await _getDB();
    await db.run("DELETE FROM allowed_chats WHERE jid = ?", jid).catch(() => {});
    _invalidateCache();
  },

  async list(type = null) {
    const db = await _getDB();
    const where = type ? "WHERE type = ? AND jid != 'global'" : "WHERE jid != 'global'";
    const params = type ? [type] : [];
    return db.all(`SELECT jid, type, name, icon, member_count, is_allowed FROM allowed_chats ${where} ORDER BY name ASC`, ...params).catch(() => []);
  },

  async syncGroups(groups) {
    const db = await _getDB();
    const { rawTxn } = await import('../infrastructure/database/database.js');
    const runs = [];
    for (const g of groups) {
      const jid = g.id;
      if (!jid) continue;
      const name = String(g.subject || g.name || jid.split('@')[0]).slice(0, 200);
      const member = g.participants?.length || 0;
      runs.push(["INSERT INTO allowed_chats (jid, type, name, member_count, is_allowed, mode) VALUES (?, 'group', ?, ?, 0, 'selected') ON CONFLICT(jid) DO UPDATE SET name = excluded.name, member_count = excluded.member_count, updated_at = datetime('now')", [jid, name, member]]);
    }
    rawTxn(runs);
    _invalidateCache();
  },

  async syncChats(contacts) {
    const db = await _getDB();
    const { rawTxn } = await import('../infrastructure/database/database.js');
    const runs = [];
    for (const c of contacts) {
      const jid = c.jid || c.id;
      if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') continue;
      const name = String(c.name || c.notify || jid.split('@')[0]).slice(0, 200);
      runs.push(["INSERT INTO allowed_chats (jid, type, name, is_allowed, mode) VALUES (?, 'chat', ?, 0, 'selected') ON CONFLICT(jid) DO UPDATE SET name = excluded.name, updated_at = datetime('now')", [jid, name]]);
    }
    rawTxn(runs);
    _invalidateCache();
  },

  async getConfig() {
    const cfg = await _loadConfig();
    return {
      mode: cfg.mode,
      groupsCount: cfg.groups.size,
      chatsCount: cfg.chats.size,
      total: cfg.count,
    };
  },

  async getStats() {
    const cfg = await _loadConfig();
    return {
      mode: cfg.mode,
      allowedGroups: Array.from(cfg.groups),
      allowedChats: Array.from(cfg.chats),
      totalAllowed: cfg.count,
      totalRows: cfg.rows.length,
    };
  },
};

export function getSelector() { return GroupSelector; }
