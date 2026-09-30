'use strict';
/**
 * Store persistant (JSON)
 * Remplace le cache RAM seul pour getMessage / antidelete / contexte.
 *
 * Historique : un chemin SQLite optionnel existait (branche `if (Database)`
 * sur better-sqlite3). Supprimé le 2026-09-30 car preuve de code mort :
 *   - require('better-sqlite3') → MODULE_NOT_FOUND (paquet jamais installé)
 *   - node_modules/better-sqlite3 absent
 *   - session/store/messages.db jamais créée
 * Le mode JSON est donc le mode unique et réel.
 */
const fs = require('fs');
const path = require('path');

class MessageStore {
  constructor(dir) {
    this.dir = dir;
    this.jsonFile = path.join(dir, 'msg-store.json');
    this.mem = new Map(); // key -> { message, ts }
    this.maxMem = 2000;
    fs.mkdirSync(dir, { recursive: true });
    this._loadJson();
  }

  _key(jid, id) {
    return `${jid}|${id}`;
  }

  _loadJson() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.jsonFile, 'utf8'));
      if (raw && typeof raw === 'object') {
        for (const [k, v] of Object.entries(raw)) {
          if (v && v.message) this.mem.set(k, v);
        }
      }
    } catch (_) {}
  }

  flushJson() {
    try {
      const obj = {};
      let i = 0;
      for (const [k, v] of this.mem) {
        obj[k] = v;
        if (++i >= this.maxMem) break;
      }
      const tmp = this.jsonFile + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(obj));
      fs.renameSync(tmp, this.jsonFile);
    } catch (e) {
      console.error('[STORE] flush JSON:', e.message);
    }
  }

  put(jid, id, fullMsg) {
    if (!jid || !id || !fullMsg) return;
    const entry = { message: fullMsg.message || fullMsg, ts: Date.now(), key: fullMsg.key || { remoteJid: jid, id } };
    const k = this._key(jid, id);
    this.mem.set(k, entry);
    while (this.mem.size > this.maxMem) {
      this.mem.delete(this.mem.keys().next().value);
    }
  }

  get(jid, id) {
    if (!jid || !id) return null;
    const k = this._key(jid, id);
    const hit = this.mem.get(k);
    if (hit) return hit;
    return null;
  }

  /** Format Baileys getMessage */
  async getMessage(key) {
    const hit = this.get(key?.remoteJid, key?.id);
    return hit?.message || undefined;
  }

  purgeOlderThan(ms = 7 * 24 * 3600 * 1000) {
    const minTs = Date.now() - ms;
    for (const [k, v] of this.mem) {
      if (v.ts < minTs) this.mem.delete(k);
    }
  }
}

let singleton = null;

function initStore(sessionDir) {
  const dir = path.join(sessionDir, 'store');
  singleton = new MessageStore(dir);
  setInterval(() => {
    try {
      singleton.flushJson();
      singleton.purgeOlderThan();
    } catch (_) {}
  }, 30000).unref?.();
  process.on('exit', () => {
    try {
      singleton.flushJson();
    } catch (_) {}
  });
  return singleton;
}

function getStore() {
  return singleton;
}

module.exports = { initStore, getStore, MessageStore };
