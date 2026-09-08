import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';
const log = createLogger('AUTOREPLY');

const keywords = new Map();
let templates = new Map();
let listener = null;
let enabled = false;

export function initAutoReplyDB() {
  rawRun(`CREATE TABLE IF NOT EXISTS autoreply_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT, jid TEXT NOT NULL,
    keyword TEXT NOT NULL, response TEXT NOT NULL,
    match_type TEXT DEFAULT 'contains', group_only INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL, hits INTEGER DEFAULT 0
  )`);
  rawRun(`CREATE TABLE IF NOT EXISTS auto_reply_settings (
    jid TEXT PRIMARY KEY, enabled INTEGER DEFAULT 1,
    group_enabled INTEGER DEFAULT 1, private_enabled INTEGER DEFAULT 1
  )`);
}

export function addKeyword(word, response) {
  keywords.set(word.toLowerCase().trim(), { response, hits: 0 });
  initAutoReplyDB();
  rawRun('INSERT INTO autoreply_templates (jid, keyword, response, match_type, created_at) VALUES (?, ?, ?, ?, ?)',
    'global', word.toLowerCase().trim(), response, 'contains', Date.now());
}

export function addTemplate(jid, keyword, response, matchType = 'contains', groupOnly = false) {
  initAutoReplyDB();
  rawRun('INSERT INTO autoreply_templates (jid, keyword, response, match_type, group_only, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    jid, keyword.toLowerCase().trim(), response, matchType, groupOnly ? 1 : 0, Date.now());
  return { success: true, id: rawGet('SELECT last_insert_rowid() as id')?.id };
}

export function removeKeyword(word, jid = 'global') {
  keywords.delete(word.toLowerCase().trim());
  rawRun('DELETE FROM autoreply_templates WHERE keyword = ? AND jid = ?', word.toLowerCase().trim(), jid);
  return true;
}

export function listKeywords(jid = null) {
  if (jid) return rawAll('SELECT * FROM autoreply_templates WHERE jid = ? OR jid = ? ORDER BY created_at DESC', jid, 'global');
  return rawAll('SELECT * FROM autoreply_templates ORDER BY hits DESC');
}

export function setAutoReplySetting(jid, setting, value) {
  initAutoReplyDB();
  rawRun('INSERT OR REPLACE INTO auto_reply_settings (jid, enabled, group_enabled, private_enabled) VALUES (?, ?, ?, ?)',
    jid, setting.enabled ? 1 : 0, setting.group_enabled ? 1 : 0, setting.private_enabled ? 1 : 0);
}

export function getAutoReplySetting(jid) {
  const row = rawGet('SELECT * FROM auto_reply_settings WHERE jid = ?', jid);
  if (!row) return { enabled: true, group_enabled: true, private_enabled: true };
  return { enabled: !!row.enabled, group_enabled: !!row.group_enabled, private_enabled: !!row.private_enabled };
}

export function enableAutoReply(sock) {
  if (enabled) return;
  enabled = true;
  initAutoReplyDB();
  const dbTemplates = rawAll('SELECT * FROM autoreply_templates');
  for (const t of dbTemplates) {
    if (!keywords.has(t.keyword)) {
      keywords.set(t.keyword, { response: t.response, hits: t.hits || 0 });
    }
  }
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
      if (!text) continue;
      const jid = msg.key.remoteJid;
      const isGroup = jid?.endsWith('@g.us');
      const settings = getAutoReplySetting(jid);
      if (!settings.enabled) continue;
      if (isGroup && !settings.group_enabled) continue;
      if (!isGroup && !settings.private_enabled) continue;
      const lower = text.toLowerCase();
      for (const [kw, data] of keywords) {
        let matched = false;
        if (lower.includes(kw)) matched = true;
        if (lower === kw) matched = true;
        if (matched) {
          data.hits = (data.hits || 0) + 1;
          rawRun('UPDATE autoreply_templates SET hits = hits + 1 WHERE keyword = ?', kw);
          sock.sendMessage(jid, { text: data.response }, { quoted: msg });
          break;
        }
      }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Auto-reply amélioré activé');
}

export function disableAutoReply(sock) {
  enabled = false;
  if (listener && sock) { try { sock.ev.off('messages.upsert', listener); } catch {} }
  log.info('Auto-reply désactivé');
}

export function isAutoReplyOn() { return enabled; }

addKeyword('bonjour', '👋 Bonjour ! Comment ça va ?');
addKeyword('salut', '👋 Salut !');
addKeyword('merci', '🙏 Avec plaisir !');
addKeyword('djousse', '👂 Oui ? Je suis là !');
