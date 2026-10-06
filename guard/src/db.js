'use strict';
/**
 * Mini base persistante — mémoire + debounce, deux moteurs au choix :
 *
 *   • SQLite (`*.db`, défaut) : transactions atomiques, requêtes
 *     indexées, un seul fichier data/bot.db à sauvegarder.
 *   • JSON (`*.json`) : comportement historique, zéro dépendance.
 *
 * Le modèle en mémoire (this.data) est STRICTEMENT identique dans les
 * deux cas : seuls load() et save() changent. Zéro dépendance native —
 * SQLite vient de node:sqlite, intégré à Node.
 */
const fs = require('fs');
const path = require('path');

const GROUP_DEFAULTS = () => ({
  antilink: false,
  antispam: false,
  antiflood: false,
  antibad: false,
  antitag: false,
  antimedia: false,
  antisticker: false,
  antivoice: false,
  antistatus: false,
  antiforward: false,
  antivirtex: false,
  anticontact: false,
  antipoll: false,
  antifake: false,
  allowedCodes: [],
  welcome: false,
  welcomeText: '',
  maxText: 4000,
  nightMode: false,
  nightStart: '22:00',
  nightEnd: '06:00',
  nightClosed: false, // état appliqué par le planificateur
  sanctions: {}, // surcharge par protection : { antistatus: 'kick' }
  sanction: 'delete', // delete | warn | kick
  warnLimit: 3,
  onWarnLimit: 'kick', // kick | mute
  muteMinutes: 30,
  floodMax: 6,
  floodWindowSec: 8,
  tagMax: 5,
  linkWhitelist: [],
  badWords: [],
  stats: { messages: 0, deleted: 0, kicked: 0, warned: 0, muted: 0, antilink: 0, antispam: 0, antiflood: 0, antibad: 0, antitag: 0, antimedia: 0, antisticker: 0, antivoice: 0, antistatus: 0, antiforward: 0, antivirtex: 0, anticontact: 0, antipoll: 0, antifake: 0 },
});

/* ── Moteur JSON (historique) : écriture atomique tmp + rename ──── */
function jsonBackend(file) {
  return {
    load() {
      try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (e) {
        if (e.code !== 'ENOENT') console.error('[DB] lecture impossible, base vide :', e.message);
        return null;
      }
    },
    save(data) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
      fs.renameSync(tmp, file);
    },
    close() {},
  };
}

/* ── Moteur SQLite (node:sqlite, même connexion que lib/db.js) ───── */
function sqliteBackend(file) {
  const lib = require('../../lib/db');
  if (!lib.available()) return jsonBackend(file); // Node trop ancien
  const db = lib.conn(file);
  db.exec(`
CREATE TABLE IF NOT EXISTS guard_groups (
  id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS guard_warns (
  gid TEXT NOT NULL, user TEXT NOT NULL, n INTEGER NOT NULL,
  PRIMARY KEY (gid, user));
CREATE TABLE IF NOT EXISTS guard_mutes (
  gid TEXT NOT NULL, user TEXT NOT NULL, until INTEGER NOT NULL,
  PRIMARY KEY (gid, user));`);

  /* Import depuis l'ancien guard.json (une seule fois : seulement si
     la table est vide). L'ancien fichier n'est PAS supprimé, pour
     permettre un retour en arrière. */
  function legacyCandidates() {
    const dir = path.dirname(file);
    return [...new Set([
      String(file).replace(/\.db$/i, '.json'),
      path.join(dir, 'guard.json'),
    ])];
  }
  function importLegacy() {
    for (const cand of legacyCandidates()) {
      let raw;
      try { raw = JSON.parse(fs.readFileSync(cand, 'utf8')); } catch { continue; }
      if (!raw || !Object.keys(raw.groups || {}).length) continue;
      save(raw);
      console.log(`[DB] 📥 Import de ${path.basename(cand)} → SQLite`
        + ` (${Object.keys(raw.groups || {}).length} groupes)`);
      return true;
    }
    return false;
  }

  function save(data) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec('DELETE FROM guard_groups; DELETE FROM guard_warns; DELETE FROM guard_mutes;');
      const ig = db.prepare('INSERT INTO guard_groups(id, data, updated_at) VALUES(?, ?, ?)');
      for (const [id, g] of Object.entries(data.groups || {})) ig.run(id, JSON.stringify(g), Date.now());
      const iw = db.prepare('INSERT INTO guard_warns(gid, user, n) VALUES(?, ?, ?)');
      for (const [gid, users] of Object.entries(data.warns || {})) {
        for (const [u, n] of Object.entries(users || {})) iw.run(gid, u, n);
      }
      const im = db.prepare('INSERT INTO guard_mutes(gid, user, until) VALUES(?, ?, ?)');
      for (const [gid, users] of Object.entries(data.mutes || {})) {
        for (const [u, t] of Object.entries(users || {})) im.run(gid, u, t);
      }
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch { /* rien à annuler */ }
      throw e;
    }
  }

  function readAll() {
    const groups = {};
    for (const r of db.prepare('SELECT id, data FROM guard_groups').all()) {
      try { groups[r.id] = JSON.parse(r.data); } catch { /* ligne corrompue */ }
    }
    const warns = {};
    for (const r of db.prepare('SELECT gid, user, n FROM guard_warns').all()) {
      (warns[r.gid] = warns[r.gid] || {})[r.user] = r.n;
    }
    const mutes = {};
    for (const r of db.prepare('SELECT gid, user, until FROM guard_mutes').all()) {
      (mutes[r.gid] = mutes[r.gid] || {})[r.user] = r.until;
    }
    return { groups, warns, mutes };
  }

  return {
    load() {
      let out = readAll();
      if (!Object.keys(out.groups).length && importLegacy()) out = readAll();
      return out;
    },
    save,
    close() { /* la connexion appartient à lib/db.js */ },
  };
}

function makeBackend(file) {
  if (/\.db$/i.test(String(file))) {
    try { return sqliteBackend(file); } catch (e) {
      console.error('[DB] SQLite indisponible, repli JSON :', e.message);
      return jsonBackend(String(file).replace(/\.db$/i, '.json'));
    }
  }
  return jsonBackend(file);
}

class Store {
  constructor(file) {
    this.file = file;
    this.timer = null;
    this.data = { groups: {}, warns: {}, mutes: {} };
    this.io = makeBackend(file);
    const loaded = this.io.load();
    if (loaded) this.data = { groups: {}, warns: {}, mutes: {}, ...loaded };
  }

  getGroup(id) {
    let g = this.data.groups[id];
    if (!g) g = this.data.groups[id] = GROUP_DEFAULTS();
    const def = GROUP_DEFAULTS();
    for (const k of Object.keys(def)) if (g[k] === undefined) g[k] = def[k];
    for (const k of Object.keys(def.stats)) if (g.stats[k] === undefined) g.stats[k] = 0;
    return g;
  }

  saveGroup(id, g) {
    this.data.groups[id] = g;
    this._schedule();
  }

  // ---- warns : warns[groupId][userNum] = count
  getWarns(gid, user) { return (this.data.warns[gid] || {})[user] || 0; }
  setWarns(gid, user, n) {
    this.data.warns[gid] = this.data.warns[gid] || {};
    if (n <= 0) delete this.data.warns[gid][user];
    else this.data.warns[gid][user] = n;
    this._schedule();
  }

  // ---- mutes : mutes[groupId][userNum] = timestamp de fin
  getMuteUntil(gid, user) { return (this.data.mutes[gid] || {})[user] || 0; }
  setMute(gid, user, until) {
    this.data.mutes[gid] = this.data.mutes[gid] || {};
    if (!until) delete this.data.mutes[gid][user];
    else this.data.mutes[gid][user] = until;
    this._schedule();
  }

  _schedule() {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 300);
    if (this.timer.unref) this.timer.unref();
  }

  flush() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    try {
      this.io.save(this.data);
    } catch (e) {
      console.error('[DB] écriture impossible :', e.message);
    }
  }

  close() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    try { this.io.close(); } catch { /* rien */ }
  }
}

let instance = null;
function init(file) {
  if (instance) instance.close(); // une seule base ouverte à la fois
  instance = new Store(file);
  return instance;
}
function db() { if (!instance) throw new Error("DB non initialisée : appelle init() d'abord"); return instance; }

module.exports = { Store, init, db, GROUP_DEFAULTS, jsonBackend, sqliteBackend, makeBackend };
