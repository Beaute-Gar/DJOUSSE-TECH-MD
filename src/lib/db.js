'use strict';
/**
 * lib/db.js — base locale SQLite (node:sqlite, AUCUNE dépendance)
 *
 *   data/bot.db
 *   ├─ kv        remplace state.json + history.json (config du bot)
 *   ├─ events    journal d'événements (commandes, sanctions, connexions)
 *   └─ messages  historique des messages reçus (requêtes rapides)
 *
 * Pourquoi SQLite plutôt que du JSON en accumulant :
 *   • écritures atomiques par transaction (plus de fichier tronqué)
 *   • requêtes indexées sur des mois de données au lieu d'un JSON relu
 *     entier à chaque sauvegarde
 *   • un SEUL fichier à sauvegarder/restaurer
 *
 * node:sqlite est intégré à Node ≥ 22.5 : zéro npm install, donc zéro
 * module natif à compiler pour l'APK Android. Si le module manque
 * (Node plus ancien), `available()` renvoie false et les appelants
 * retombent sur les fichiers JSON d'origine.
 */
const fs = require('fs');
const path = require('path');
const { inData, DATA_DIR } = require('./dataDir');

let sqliteMod = null;
try { sqliteMod = require('node:sqlite'); } catch { /* Node < 22.5 */ }

const available = () => !!sqliteMod;

const DB_FILE = path.join(DATA_DIR, 'bot.db');

/* Connexions ouvertes : une par fichier (les tests en ouvrent plusieurs) */
const conns = new Map();

const SCHEMA = `
CREATE TABLE IF NOT EXISTS kv (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  ts     INTEGER NOT NULL,
  type   TEXT NOT NULL,
  chat   TEXT,
  actor  TEXT,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_ts   ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type, ts);
CREATE TABLE IF NOT EXISTS messages (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  ts     INTEGER NOT NULL,
  chat   TEXT,
  sender TEXT,
  kind   TEXT,
  cmd    TEXT,
  len    INTEGER,
  text   TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat, ts);
CREATE INDEX IF NOT EXISTS idx_messages_ts   ON messages(ts);
`;

/* Fenêtre de rétention : 30 jours ou 50 000 messages, réglable en .env */
const KEEP_DAYS = Number(process.env.DB_KEEP_DAYS) > 0 ? Number(process.env.DB_KEEP_DAYS) : 30;
const MAX_ROWS = Number(process.env.DB_MAX_ROWS) > 0 ? Number(process.env.DB_MAX_ROWS) : 50000;

/**
 * Connexion partagée vers un fichier. Ouvre (créant le dossier au besoin)
 * et met en place les pragmas de robustesse.
 */
function conn(file = DB_FILE) {
  if (conns.has(file)) return conns.get(file);
  fs.mkdirSync(path.dirname(file), { recursive: true }); // dossier data/ absent au 1er lancement
  const db = new sqliteMod.DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA busy_timeout = 3000;'); // deux writers → on attend, on ne casse pas
  db.exec(SCHEMA);
  conns.set(file, db);
  prune(db);
  return db;
}

/** Libère les connexions (arrêt propre / tests). */
function close(file) {
  if (file) {
    const db = conns.get(file);
    conns.delete(file);
    try { db.close(); } catch { /* déjà fermée */ }
    return;
  }
  for (const [f, db] of conns) {
    conns.delete(f);
    try { db.close(); } catch { /* déjà fermée */ }
  }
}

/* ── Rétention : jamais un fichier qui grossit sans limite ──────── */
function prune(db) {
  try {
    db.exec(`DELETE FROM messages WHERE ts < ${Date.now() - KEEP_DAYS * 86400000}`);
    const over = db.prepare('SELECT COUNT(*) AS n FROM messages').get().n - MAX_ROWS;
    if (over > 0) {
      db.exec(`DELETE FROM messages WHERE id IN
               (SELECT id FROM messages ORDER BY id ASC LIMIT ${over})`);
    }
    // le journal garde deux fois plus longtemps que l'historique
    db.exec(`DELETE FROM events WHERE ts < ${Date.now() - KEEP_DAYS * 2 * 86400000}`);
  } catch (e) {
    console.error('[DB] purge impossible :', e.message);
  }
}

/* ── kv : remplace state.json / history.json ────────────────────── */
function getJSON(key, fallback = null, file) {
  try {
    const row = conn(file).prepare('SELECT value FROM kv WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : fallback;
  } catch (e) {
    console.error('[DB] lecture', key, ':', e.message);
    return fallback;
  }
}

function setJSON(key, value, file) {
  conn(file)
    .prepare('INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value));
}

function has(key, file) {
  try { return !!conn(file).prepare('SELECT 1 FROM kv WHERE key = ?').get(key); } catch { return false; }
}

/* ── Journal d'événements ───────────────────────────────────────── */
/**
 * @param {object} e  { type, chat, actor, detail }
 *   type : cmd | protect | join | leave | link | error | boot
 *   Jamais d'exception remontée : un souci de journal ne doit pas
 *   empêcher une commande de s'exécuter.
 */
function logEvent(e, file) {
  try {
    conn(file)
      .prepare('INSERT INTO events(ts, type, chat, actor, detail) VALUES(?, ?, ?, ?, ?)')
      .run(Date.now(), String(e.type || 'info'), e.chat || null, e.actor || null, e.detail || null);
  } catch (err) {
    console.error('[DB] événement non journalisé :', err.message);
  }
}

function recentEvents({ limit = 20, type = '', chat = '' } = {}) {
  const n = Math.max(1, Math.min(200, Number(limit) || 20));
  const where = [];
  const args = [];
  if (type) { where.push('type = ?'); args.push(type); }
  if (chat) { where.push('chat = ?'); args.push(chat); }
  const sql = 'SELECT ts, type, chat, actor, detail FROM events'
    + (where.length ? ` WHERE ${where.join(' AND ')}` : '')
    + ' ORDER BY id DESC LIMIT ?';
  try { return conn().prepare(sql).all(...args, n).reverse(); } catch (e) {
    console.error('[DB] journal :', e.message);
    return [];
  }
}

function eventCounts() {
  try { return conn().prepare('SELECT type, COUNT(*) AS n FROM events GROUP BY type').all(); }
  catch { return []; }
}

/* ── Historique de messages ─────────────────────────────────────── */
function logMessage({ chat, sender, kind, cmd, len, text } = {}, file) {
  try {
    conn(file)
      .prepare('INSERT INTO messages(ts, chat, sender, kind, cmd, len, text) VALUES(?, ?, ?, ?, ?, ?, ?)')
      .run(Date.now(), chat || null, sender || null, kind || null, cmd || null,
        Number(len) || 0, text ? String(text).slice(0, 300) : null);
  } catch (err) {
    console.error('[DB] message non journalisé :', err.message);
  }
}

function recentMessages({ limit = 20, chat = '', sender = '' } = {}) {
  const n = Math.max(1, Math.min(500, Number(limit) || 20));
  const where = [];
  const args = [];
  if (chat) { where.push('chat = ?'); args.push(chat); }
  if (sender) { where.push('sender = ?'); args.push(sender); }
  const sql = 'SELECT ts, chat, sender, kind, cmd, len, text FROM messages'
    + (where.length ? ` WHERE ${where.join(' AND ')}` : '')
    + ' ORDER BY id DESC LIMIT ?';
  try { return conn().prepare(sql).all(...args, n).reverse(); } catch (e) {
    console.error('[DB] historique :', e.message);
    return [];
  }
}

function counts() {
  if (!available()) return null;
  try {
    return {
      messages: conn().prepare('SELECT COUNT(*) AS n FROM messages').get().n,
      events: conn().prepare('SELECT COUNT(*) AS n FROM events').get().n,
      kv: conn().prepare('SELECT COUNT(*) AS n FROM kv').get().n,
      bytes: (() => { try { return fs.statSync(DB_FILE).size; } catch { return 0; } })(),
      file: DB_FILE,
    };
  } catch { return null; }
}

/* Redimensionne le journal à la volée (commande propriétaire) */
function purgeJournal(days) {
  const d = Math.max(1, Number(days) || 30);
  const before = conn().prepare('SELECT COUNT(*) AS n FROM events').get().n;
  conn().prepare('DELETE FROM events WHERE ts < ?').run(Date.now() - d * 86400000);
  const after = conn().prepare('SELECT COUNT(*) AS n FROM events').get().n;
  return before - after;
}

module.exports = {
  available, file: () => DB_FILE, conn, close,
  getJSON, setJSON, has, prune,
  logEvent, recentEvents, eventCounts, purgeJournal,
  logMessage, recentMessages, counts,
  KEEP_DAYS, MAX_ROWS, DATA_DIR, inData,
};
