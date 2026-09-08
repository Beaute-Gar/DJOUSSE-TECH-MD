import { createLogger } from '../../infrastructure/logger.js';
import { getDB, rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const config = require('../../../config.cjs');
const log = createLogger('DJOUSSE-SRV');

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';

/* ── DbService (collection + id → JSON persistence) ─────── */

const DB_STORE = 'djousse_store';
const DB_LOGS = 'djousse_logs';

function _ensureTables() {
  rawRun(`CREATE TABLE IF NOT EXISTS ${DB_STORE} (collection TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (collection, key))`);
  rawRun(`CREATE TABLE IF NOT EXISTS ${DB_LOGS} (collection TEXT NOT NULL, jid TEXT NOT NULL, entries TEXT NOT NULL DEFAULT '[]', PRIMARY KEY (collection, jid))`);
}

function _isPG() {
  try {
    const db = getDB();
    return db && db._pool !== undefined;
  } catch {
    return false;
  }
}

export class RealDbService {
  constructor() {
    _ensureTables();
  }

  async get(collection, id) {
    if (_isPG()) {
      const db = getDB();
      try {
        const row = await db.get(`SELECT value FROM ${DB_STORE} WHERE collection = $1 AND key = $2`, collection, id);
        return row ? JSON.parse(row.value) : null;
      } catch { return null; }
    }
    const row = rawGet(`SELECT value FROM ${DB_STORE} WHERE collection = ? AND key = ?`, collection, id);
    if (!row) return null;
    try { return JSON.parse(row.value); } catch { return null; }
  }

  async save(collection, id, data) {
    const value = JSON.stringify(data);
    if (_isPG()) {
      const db = getDB();
      try {
        await db.run(`INSERT INTO ${DB_STORE} (collection, key, value) VALUES ($1, $2, $3) ON CONFLICT(collection, key) DO UPDATE SET value = excluded.value`, collection, id, value);
      } catch (e) { log.error(`save PG: ${e.message}`); }
      return;
    }
    rawRun(`INSERT OR REPLACE INTO ${DB_STORE} (collection, key, value) VALUES (?, ?, ?)`, collection, id, value);
  }

  async saveFile(groupId, filename, content) {
    await this.save('vfs_files', `${groupId}:${filename}`, content);
  }

  async addLogEntry(collection, jid, entry, maxEntries = 100) {
    if (_isPG()) {
      const db = getDB();
      try {
        const row = await db.get(`SELECT entries FROM ${DB_LOGS} WHERE collection = $1 AND jid = $2`, collection, jid);
        let entries = row ? JSON.parse(row.entries) : [];
        entries.push(entry);
        if (entries.length > maxEntries) entries = entries.slice(-maxEntries);
        await db.run(`INSERT INTO ${DB_LOGS} (collection, jid, entries) VALUES ($1, $2, $3) ON CONFLICT(collection, jid) DO UPDATE SET entries = excluded.entries`, collection, jid, JSON.stringify(entries));
      } catch (e) { log.error(`addLogEntry PG: ${e.message}`); }
      return;
    }
    let row = rawGet(`SELECT entries FROM ${DB_LOGS} WHERE collection = ? AND jid = ?`, collection, jid);
    let entries = row ? JSON.parse(row.entries) : [];
    entries.push(entry);
    if (entries.length > maxEntries) entries = entries.slice(-maxEntries);
    rawRun(`INSERT OR REPLACE INTO ${DB_LOGS} (collection, jid, entries) VALUES (?, ?, ?)`, collection, jid, JSON.stringify(entries));
  }

  async getLogEntries(collection, jid) {
    if (_isPG()) {
      const db = getDB();
      try {
        const row = await db.get(`SELECT entries FROM ${DB_LOGS} WHERE collection = $1 AND jid = $2`, collection, jid);
        return row ? JSON.parse(row.entries) : [];
      } catch { return []; }
    }
    const row = rawGet(`SELECT entries FROM ${DB_LOGS} WHERE collection = ? AND jid = ?`, collection, jid);
    if (!row) return [];
    try { return JSON.parse(row.entries); } catch { return []; }
  }
}

/* ── LlmService (Groq API wrapper) ──────────────────────── */

export class RealLlmService {
  async callGroq(prompt) {
    if (!GROQ_API_KEY) return '';
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [{ role: 'system', content: 'Tu es un assistant IA intégré à un bot WhatsApp. Réponds toujours en JSON valide, sans texte additionnel.' }, { role: 'user', content: prompt }],
          temperature: 0.7,
          max_completion_tokens: 1024,
        }),
      });
      if (!res.ok) { log.warn(`Groq API ${res.status}`); return ''; }
      const data = await res.json();
      return data?.choices?.[0]?.message?.content?.trim() || '';
    } catch (e) {
      log.error(`callGroq: ${e.message}`);
      return '';
    }
  }
}

/* ── WhatsappService (wraps sock) ───────────────────────── */

export class RealWhatsappService {
  constructor(sock) {
    this.sock = sock;
  }

  setSock(sock) {
    this.sock = sock;
  }

  async sendMessage(jid, content) {
    if (!this.sock) throw new Error('WhatsApp socket non initialisé');
    await this.sock.sendMessage(jid, content);
  }

  async banUser(jid, userId) {
    if (!this.sock) throw new Error('WhatsApp socket non initialisé');
    await this.sock.groupParticipantsUpdate(jid, [userId], 'remove');
  }

  async muteUser(jid, userId, durationMinutes) {
    log.warn(`muteUser non implémenté via Baileys: ${userId} dans ${jid} pour ${durationMinutes}min`);
  }
}

/* ── SchedulerService (node-cron + reminder) ────────────── */

export class RealSchedulerService {
  async scheduleReminder(jid, message, delai) {
    const { default: cron } = await import('node-cron');
    const parts = delai.match(/J\+(\d+)/);
    if (!parts) { log.warn(`scheduleReminder: délai non reconnu "${delai}"`); return; }
    const jours = parseInt(parts[1]);
    const date = new Date(Date.now() + jours * 86400000);
    const expr = `${date.getMinutes()} ${date.getHours()} ${date.getDate()} ${date.getMonth() + 1} *`;
    cron.schedule(expr, async () => {
      try {
        const sock = getSock?.();
        if (sock) await sock.sendMessage(jid, { text: `⏰ *Rappel programmé*\n\n${message}` });
      } catch (e) { log.error(`scheduleReminder exec: ${e.message}`); }
    });
  }

  async scheduleMessage(jid, text, date) {
    const { default: cron } = await import('node-cron');
    const d = new Date(date);
    if (isNaN(d.getTime())) { log.warn(`scheduleMessage: date invalide "${date}"`); return; }
    const expr = `${d.getMinutes()} ${d.getHours()} ${d.getDate()} ${d.getMonth() + 1} *`;
    cron.schedule(expr, async () => {
      try {
        const sock = getSock?.();
        if (sock) await sock.sendMessage(jid, { text });
      } catch (e) { log.error(`scheduleMessage exec: ${e.message}`); }
    });
  }
}

/* ── getSock (référence externe, settée par bot.js) ────── */

let _sockRef = null;
export function setSockRef(sock) { _sockRef = sock; }
export function getSock() { return _sockRef; }
