'use strict';
/**
 * wa-presence.js — présence et accusés de lecture réalistes
 * ─────────────────────────────────────────────────────────────────
 * Un bot qui marque « vu » instantanément, 100 % du temps, 24 h/24 est
 * immédiatement repérable. Ce module introduit :
 *
 *   - lecture PROBABILISTE (une partie des messages reste non lue) ;
 *   - délai humain avant le « vu » (jamais < 1,5 s après réception) ;
 *   - créneaux « téléphone posé » tirés une fois par jour et persistés ;
 *   - respect des heures d'activité du persona (wa-identity) ;
 *   - synchro available/unavailable (sendPresenceUpdate) ;
 *   - « lu sans réponse » disponible pour les flux non critiques.
 *
 * Il ne remplace PAS lib/presence.js (présence ENTRANTE .seen) : les deux
 * sont complémentaires. Aucun listener Baileys n'est installé ici.
 */

const fs = require('fs');
const path = require('path');
const { normalizeJid } = require('./wa-delay');

const DEFAULTS = {
  READ_PROBABILITY: 0.92,
  MIN_READ_DELAY_MS: 1500,
  MAX_READ_DELAY_MS: 45000,
  READ_WITHOUT_REPLY_PROB: 0.12,
  OFFLINE_CHUNKS: 3,
  OFFLINE_MIN_MS: 20 * 60000,
  OFFLINE_MAX_MS: 2 * 3600000,
  RESPECT_PERSONA: true,
  PERSIST_FILE: null,
  VERBOSE: false,
};

/** Millisecondes écoulées depuis minuit, en heure LOCALE. */
function msOfDay(now) {
  const d = new Date(now);
  return ((d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds()) * 1000 + d.getMilliseconds();
}

function dayKey(now = Date.now()) {
  const d = new Date(now);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** messageTimestamp Baileys : number, string ou Long → secondes Unix. */
function unixSeconds(value) {
  if (value === null || value === undefined) return 0;
  let n = 0;
  if (typeof value === 'number') n = value;
  else if (typeof value === 'string') n = Number(value);
  else if (typeof value.toNumber === 'function') n = value.toNumber();
  else if (typeof value.valueOf === 'function') n = Number(value.valueOf());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 1e12 ? n / 1000 : n; // millisecondes → secondes
}

class PresenceManager {
  /**
   * @param {object} opts
   * @param {object} [opts.identity] SessionIdentity (heures d'activité)
   * @param {object} [opts.cfg]      surcharge de DEFAULTS
   */
  constructor(opts = {}) {
    this.identity = opts.identity || null;
    this.cfg = { ...DEFAULTS, ...(opts.cfg || opts) };
    this._syncTimer = null;
    this.state = this._load() || {
      dayKey: dayKey(),
      offlineWindows: this._drawOfflineWindows(),
      lastRead: {},
    };
    this._rollDayIfNeeded();
  }

  /* ─── Persistance ────────────────────────────────────────────── */

  _load() {
    if (!this.cfg.PERSIST_FILE) return null;
    try {
      if (!fs.existsSync(this.cfg.PERSIST_FILE)) return null;
      const saved = JSON.parse(fs.readFileSync(this.cfg.PERSIST_FILE, 'utf8'));
      if (saved && saved.dayKey && Array.isArray(saved.offlineWindows)) return saved;
    } catch {
      /* état illisible → nouvelle journée */
    }
    return null;
  }

  _save() {
    if (!this.cfg.PERSIST_FILE) return;
    try {
      fs.mkdirSync(path.dirname(this.cfg.PERSIST_FILE), { recursive: true });
      fs.writeFileSync(this.cfg.PERSIST_FILE, JSON.stringify(this.state, null, 2));
    } catch {
      /* non bloquant */
    }
  }

  /* ─── Créneaux « hors ligne » ────────────────────────────────── */

  _drawOfflineWindows() {
    const windows = [];
    const min = Math.max(60000, Number(this.cfg.OFFLINE_MIN_MS) || DEFAULTS.OFFLINE_MIN_MS);
    const max = Math.max(min, Number(this.cfg.OFFLINE_MAX_MS) || DEFAULTS.OFFLINE_MAX_MS);
    for (let i = 0; i < Math.max(0, Number(this.cfg.OFFLINE_CHUNKS) || 0); i += 1) {
      const start = Math.random() * 86400000;
      const duration = min + Math.random() * (max - min);
      windows.push({ start, end: start + duration });
    }
    return windows;
  }

  _rollDayIfNeeded() {
    const current = dayKey();
    if (this.state.dayKey !== current) {
      this.state.dayKey = current;
      this.state.offlineWindows = this._drawOfflineWindows();
      this.state.lastRead = {};
      this._save();
      if (this.cfg.VERBOSE) console.log('[WA-PRESENCE] nouveaux créneaux hors ligne pour', current);
    }
  }

  /* ─── État « téléphone posé » ───────────────────────────────── */

  _personaOffline(now) {
    if (!this.cfg.RESPECT_PERSONA || !this.identity || typeof this.identity.isActiveNow !== 'function') {
      return false;
    }
    return !this.identity.isActiveNow(new Date(now));
  }

  /** Le compte est-il indisponible à cet instant ? */
  isOfflineNow(now = Date.now()) {
    this._rollDayIfNeeded();
    if (this._personaOffline(now)) return true;
    const ms = msOfDay(now);
    return this.state.offlineWindows.some((w) => ms >= w.start && ms < w.end);
  }

  /** Durée avant de redevenir actif (0 = déjà actif). */
  timeUntilOnline(now = Date.now()) {
    if (!this.isOfflineNow(now)) return 0;
    const ms = msOfDay(now);
    let wait = Infinity;

    for (const w of this.state.offlineWindows) {
      if (ms >= w.start && ms < w.end) wait = Math.min(wait, w.end - ms);
    }

    if (this._personaOffline(now)) {
      const start = this.identity?.data?.persona?.activeHours?.[0];
      if (Number.isFinite(start)) {
        const hour = new Date(now).getHours();
        const hours = ((start - hour + 24) % 24) || 24;
        wait = Math.min(wait, hours * 3600000);
      }
    }

    return Number.isFinite(wait) ? Math.round(wait) : 0;
  }

  /* ─── Décision de lecture ───────────────────────────────────── */

  /**
   * Faut-il marquer ce message comme lu ? (probabiliste + contexte)
   * @param {object} msg  message Baileys
   * @param {string} [text]
   */
  shouldRead(msg, text = '') {
    if (this.isOfflineNow()) return false;

    /* Anti-signal : jamais de « vu » dans les 1,5 s qui suivent la réception. */
    const ts = unixSeconds(msg?.messageTimestamp);
    if (ts && Date.now() / 1000 - ts < 1.5) return false;

    const base = Math.min(0.99, Math.max(0, Number(this.cfg.READ_PROBABILITY) || 0));
    const probability = String(text || '').length > 60 ? Math.min(0.99, base + 0.05) : base;
    return Math.random() < probability;
  }

  /** Délai humain avant l'accusé de lecture. */
  readDelay() {
    const min = Math.max(0, Number(this.cfg.MIN_READ_DELAY_MS) || 0);
    const max = Math.max(min, Number(this.cfg.MAX_READ_DELAY_MS) || min);
    return Math.round(min + Math.random() * (max - min));
  }

  /**
   * Programme un accusé de lecture réaliste, sans bloquer le flux.
   * @returns {boolean} true si un « vu » a été programmé
   */
  scheduleRead(sock, msg, text = '') {
    if (!sock || typeof sock.readMessages !== 'function' || !msg?.key) return false;
    if (!this.shouldRead(msg, text)) return false;

    const delay = this.readDelay();
    const timer = setTimeout(() => {
      if (this.isOfflineNow()) return;
      try {
        const result = sock.readMessages([msg.key]);
        if (result && typeof result.catch === 'function') result.catch(() => {});
        if (msg.key.remoteJid) {
          this.state.lastRead[normalizeJid(msg.key.remoteJid)] = Date.now();
        }
        if (this.cfg.VERBOSE) console.log('[WA-PRESENCE] message lu après', delay, 'ms');
      } catch {
        /* un accusé de lecture ne doit jamais casser le traitement */
      }
    }, delay);
    if (timer.unref) timer.unref();
    return true;
  }

  /**
   * « Lu mais sans réponse » : à réserver aux messages NON critiques
   * (jamais une commande, jamais un événement guard). Probabilité faible.
   */
  shouldSkipReply() {
    const probability = Math.max(0, Math.min(1, Number(this.cfg.READ_WITHOUT_REPLY_PROB) || 0));
    return Math.random() < probability;
  }

  /* ─── Statut en ligne ───────────────────────────────────────── */

  /** Envoie available/unavailable selon l'état courant. */
  async syncPresence(sock) {
    if (!sock || typeof sock.sendPresenceUpdate !== 'function') return;
    try {
      await sock.sendPresenceUpdate(this.isOfflineNow() ? 'unavailable' : 'available');
    } catch {
      /* un statut de présence n'est jamais critique */
    }
  }

  /** Boucle de synchronisation (timer non bloquant pour l'arrêt du process). */
  startAutoSync(sock, intervalMs = 5 * 60000) {
    this.stopAutoSync();
    this.syncPresence(sock);
    this._syncTimer = setInterval(() => this.syncPresence(sock), Math.max(30000, intervalMs));
    if (this._syncTimer.unref) this._syncTimer.unref();
  }

  stopAutoSync() {
    if (this._syncTimer) clearInterval(this._syncTimer);
    this._syncTimer = null;
  }

  stop() {
    this.stopAutoSync();
    this._save();
  }
}

module.exports = { PresenceManager, DEFAULTS, msOfDay, unixSeconds };
