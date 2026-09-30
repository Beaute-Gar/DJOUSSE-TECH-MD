'use strict';
/**
 * Mini base persistante (JSON, écriture atomique + debounce).
 * Zéro dépendance native. Pour brancher ta base existante (SQLite/Mongo/etc.),
 * il suffit de réimplémenter : getGroup, saveGroup, warns, mutes, flush.
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

class Store {
  constructor(file) {
    this.file = file;
    this.timer = null;
    this.data = { groups: {}, warns: {}, mutes: {} };
    this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      this.data = { groups: {}, warns: {}, mutes: {}, ...parsed };
    } catch (e) {
      if (e.code !== 'ENOENT') console.error('[DB] lecture impossible, base vide :', e.message);
    }
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
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
      fs.renameSync(tmp, this.file);
    } catch (e) {
      console.error('[DB] écriture impossible :', e.message);
    }
  }
}

let instance = null;
function init(file) { instance = new Store(file); return instance; }
function db() { if (!instance) throw new Error("DB non initialisée : appelle init() d'abord"); return instance; }

module.exports = { Store, init, db, GROUP_DEFAULTS };
