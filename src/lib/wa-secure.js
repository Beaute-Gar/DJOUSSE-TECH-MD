'use strict';
/**
 * wa-secure.js — couche d'envoi réaliste (file par JID, bursts, quotas)
 * ─────────────────────────────────────────────────────────────────
 * Ce module ne remplace PAS le service d'envoi : tous les envois passent
 * par src/lib/wa-send.js (garantie G2). Il ajoute, au-dessus :
 *
 *   - une file SÉRIALISÉE par destinataire : jamais deux messages en
 *     parallèle dans le même chat (un humain ne le fait pas) ;
 *   - des bursts de frappe pour les textes longs (composing/paused) ;
 *   - des quotas minute/heure/jour + période de chauffe du compte ;
 *   - une blacklist/allowlist de JID et une normalisation des numéros ;
 *   - des statistiques persistées sur disque ;
 *   - une attente de reconnexion avant nouvel essai.
 *
 * Compatibilité : Baileys 6.x, Node 18+, aucune dépendance nouvelle.
 * Aucun listener Baileys n'est installé ici.
 */

const fs = require('fs');
const path = require('path');
const {
  sleep,
  applyJitter,
  computeDelay,
  isGroupJid,
  isStatusJid,
  isNewsletterJid,
  normalizeJid,
} = require('./wa-delay');

const DEFAULT_CONFIG = {
  BASE_THINK_MS: 1200,
  READ_CPS: 25,
  TYPE_CPS: 18,
  JITTER: 0.25,
  MIN_DELAY_MS: 800,
  MAX_DELAY_MS: 25000,

  GROUP_DELAY_FACTOR: 0.6,
  DM_DELAY_FACTOR: 1.0,
  STATUS_DELAY_MS: 300,

  PER_MINUTE: 20,
  PER_HOUR: 200,
  PER_DAY: 1000,

  WARMUP_ENABLED: true,
  WARMUP_DAYS: 7,

  MAX_RETRIES: 3,
  RETRY_BASE_MS: 1000,
  RECONNECT_BACKOFF: [5000, 10000, 30000, 60000, 120000],

  /* ─── v2 ─────────────────────────────────────────────────────── */
  BURST_ENABLED: true,
  BURST_MIN_LEN: 180,
  BURST_SEGMENTS: 3,
  BURST_MAX_TOTAL_MS: 12000,
  QUEUE_ENABLED: true,
  QUEUE_MAX_PER_JID: 20,
  QUEUE_TIMEOUT_MS: 120000,
  MAX_TEXT_LEN: 4000,
  STATE_FILE: null,
  BLACKLIST: [],
  ALLOWLIST: null,
  REACTION_BIAS: 1,
  SKIP_READ: false,
  VERBOSE: false,
};

/* ─── Découpage d'un texte long en segments de frappe ──────────── */

function splitBursts(text, segments) {
  const source = String(text || '');
  const count = Math.max(1, Math.floor(Number(segments) || 1));
  if (!source) return [];
  if (count === 1) return [source];

  const target = Math.ceil(source.length / count);
  const parts = [];
  let rest = source;

  while (rest.length > 0) {
    if (rest.length <= target) {
      parts.push(rest);
      break;
    }
    let cut = target;
    const windowStart = Math.max(0, target - 40);
    const zone = rest.slice(windowStart, Math.min(rest.length, target + 40));
    const matches = [...zone.matchAll(/[.!?\n,]/g)];
    if (matches.length) {
      const last = matches[matches.length - 1];
      cut = windowStart + last.index + 1;
    }
    cut = Math.max(1, Math.min(cut, rest.length));
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  return parts.filter(Boolean);
}

/* ─── Quotas fenêtrés ──────────────────────────────────────────── */

class RateLimiter {
  constructor(cfg) {
    this.cfg = cfg;
    this.events = [];
    this._purgeTimer = setInterval(() => this._purge(), 60000);
    if (this._purgeTimer.unref) this._purgeTimer.unref();
  }

  _purge() {
    const cutoff = Date.now() - 86400000;
    this.events = this.events.filter((at) => at > cutoff);
  }

  _countIn(windowMs) {
    const cutoff = Date.now() - windowMs;
    let count = 0;
    for (let i = this.events.length - 1; i >= 0; i -= 1) {
      if (this.events[i] > cutoff) count += 1;
      else break;
    }
    return count;
  }

  check() {
    if (this._countIn(60000) >= this.cfg.PER_MINUTE) {
      return { ok: false, reason: 'RATE_MINUTE', limit: this.cfg.PER_MINUTE };
    }
    if (this._countIn(3600000) >= this.cfg.PER_HOUR) {
      return { ok: false, reason: 'RATE_HOUR', limit: this.cfg.PER_HOUR };
    }
    if (this._countIn(86400000) >= this.cfg.PER_DAY) {
      return { ok: false, reason: 'RATE_DAY', limit: this.cfg.PER_DAY };
    }
    return { ok: true };
  }

  record() {
    this.events.push(Date.now());
  }

  stats() {
    return {
      minute: this._countIn(60000),
      hour: this._countIn(3600000),
      day: this._countIn(86400000),
    };
  }

  stop() {
    if (this._purgeTimer) clearInterval(this._purgeTimer);
    this._purgeTimer = null;
  }
}

/* ─── Montée en charge (compte récent = plus prudent) ──────────── */

class Warmup {
  constructor(cfg, startTs) {
    this.cfg = cfg;
    this.startTs = Number(startTs) || Date.now();
  }

  multiplier() {
    if (!this.cfg.WARMUP_ENABLED) return 1;
    const days = (Date.now() - this.startTs) / 86400000;
    if (days < 1) return 2.5;
    if (days < 3) return 2.0;
    if (days < this.cfg.WARMUP_DAYS) return 1.5;
    return 1.0;
  }

  info() {
    return {
      ageDays: Number(((Date.now() - this.startTs) / 86400000).toFixed(2)),
      multiplier: this.multiplier(),
    };
  }
}

/* ─── File sérialisée par JID ──────────────────────────────────── */

class JidQueue {
  constructor(cfg) {
    this.cfg = cfg || {};
    this.queues = new Map(); // jid → { tail: Promise, pending: number }
  }

  enqueue(jid, fn) {
    if (this.cfg.QUEUE_ENABLED === false) return Promise.resolve().then(fn);

    const key = normalizeJid(jid) || String(jid || '');
    let entry = this.queues.get(key);
    if (!entry) {
      entry = { tail: Promise.resolve(), pending: 0 };
      this.queues.set(key, entry);
    }

    const max = Math.max(1, Number(this.cfg.QUEUE_MAX_PER_JID) || 20);
    if (entry.pending >= max) {
      return Promise.reject(new Error(`WaSecure QUEUE_FULL: ${key} (${entry.pending} en attente)`));
    }

    entry.pending += 1;

    const run = entry.tail.then(() => {
      const timeoutMs = Number(this.cfg.QUEUE_TIMEOUT_MS) || 0;
      if (timeoutMs <= 0) return Promise.resolve().then(fn);

      let timer = null;
      const timeout = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`WaSecure QUEUE_TIMEOUT: ${key}`)), timeoutMs);
        if (timer.unref) timer.unref();
      });
      return Promise.race([Promise.resolve().then(fn), timeout]).finally(() => {
        if (timer) clearTimeout(timer);
      });
    });

    /* La chaîne de fond ne doit JAMAIS rester rejetée : sinon le prochain
       envoi du même JID partirait immédiatement en erreur. L'appelant
       reçoit `cleaned`, qui inclut la décrémentation du compteur. */
    const cleaned = run.finally(() => {
      entry.pending = Math.max(0, entry.pending - 1);
      if (entry.pending === 0) this.queues.delete(key);
    });
    entry.tail = cleaned.catch(() => {});

    return cleaned;
  }

  pendingFor(jid) {
    const key = normalizeJid(jid) || String(jid || '');
    return this.queues.get(key)?.pending || 0;
  }

  get pendingTotal() {
    let total = 0;
    for (const entry of this.queues.values()) total += entry.pending;
    return total;
  }
}

/* ─── Façade d'envoi réaliste ──────────────────────────────────── */

class WaSecure {
  /**
   * @param {object} sock socket Baileys
   * @param {object} [config] réservé (compat)
   * @param {object} [options] { cfg, sendFn, warmupStart }
   */
  constructor(sock, config = {}, options = {}) {
    if (!sock) throw new Error('WaSecure: sock requis');
    this.sock = sock;
    this.config = config || {};
    this.cfg = { ...DEFAULT_CONFIG, ...(options.cfg || options || {}) };
    this.sendFn = options.sendFn || null;

    this.limiter = new RateLimiter(this.cfg);
    this.warmup = new Warmup(this.cfg, options.warmupStart);
    this.queue = new JidQueue(this.cfg);

    this.blacklist = new Set((this.cfg.BLACKLIST || []).map(normalizeJid));
    this.allowlist = this.cfg.ALLOWLIST
      ? new Set(this.cfg.ALLOWLIST.map(normalizeJid))
      : null;

    this.stats = {
      sent: 0,
      sentByJid: {},
      errors: 0,
      rateLimited: 0,
      retried: 0,
      queued: 0,
      queueDropped: 0,
      bursts: 0,
      startedAt: Date.now(),
    };
    this._loadStats();

    if (this.cfg.VERBOSE) {
      console.log('[WA-SECURE] initialisé — chauffe:', this.warmup.info());
    }
  }

  /* ─── Statistiques persistées ───────────────────────────────── */

  _loadStats() {
    if (!this.cfg.STATE_FILE) return;
    try {
      if (!fs.existsSync(this.cfg.STATE_FILE)) return;
      const saved = JSON.parse(fs.readFileSync(this.cfg.STATE_FILE, 'utf8'));
      Object.assign(this.stats, saved, { startedAt: Date.now() });
      if (!this.stats.sentByJid || typeof this.stats.sentByJid !== 'object') this.stats.sentByJid = {};
    } catch {
      /* fichier corrompu → on repart de zéro */
    }
  }

  saveStats() {
    if (!this.cfg.STATE_FILE) return;
    try {
      fs.mkdirSync(path.dirname(this.cfg.STATE_FILE), { recursive: true });
      fs.writeFileSync(this.cfg.STATE_FILE, JSON.stringify(this.stats, null, 2));
    } catch {
      /* non bloquant */
    }
  }

  /* ─── Accès et connexion ────────────────────────────────────── */

  _isAllowed(jid) {
    const target = normalizeJid(jid);
    if (this.blacklist.has(target)) return false;
    if (this.allowlist && !this.allowlist.has(target) && !isGroupJid(target)) return false;
    return true;
  }

  _isConnected() {
    const ws = this.sock?.ws;
    if (ws && typeof ws.isOpen === 'boolean') return ws.isOpen;
    if (typeof this.sock?.connection === 'string') return this.sock.connection !== 'close';
    return true;
  }

  /* ─── Utilitaires internes ──────────────────────────────────── */

  _log(message, extra) {
    if (!this.cfg.VERBOSE) return;
    if (extra) console.log(`[WA-SECURE] ${message}`, extra);
    else console.log(`[WA-SECURE] ${message}`);
  }

  _trackSend(jid) {
    const target = normalizeJid(jid);
    this.stats.sent += 1;
    const key = isGroupJid(target)
      ? 'groups'
      : isStatusJid(target)
        ? 'status'
        : isNewsletterJid(target)
          ? 'newsletter'
          : 'dm';
    this.stats.sentByJid[key] = (this.stats.sentByJid[key] || 0) + 1;
    this.saveStats();
  }

  _extractIncoming(msg) {
    if (!msg?.message) return '';
    const m = msg.message;
    return m.conversation
      || m.extendedTextMessage?.text
      || m.imageMessage?.caption
      || m.videoMessage?.caption
      || m.documentMessage?.caption
      || '';
  }

  async _markRead(msg) {
    if (this.cfg.SKIP_READ || !msg?.key || msg.key.fromMe) return;
    try {
      await this.sock.readMessages?.([msg.key]);
    } catch (e) {
      this._log('readMessages échec:', e.message);
    }
  }

  async _presence(jid, state) {
    try {
      await this.sock.sendPresenceUpdate?.(state, jid);
    } catch (e) {
      this._log(`presence ${state} échec:`, e.message);
    }
  }

  /** Frappe segmentée, plafonnée pour ne jamais bloquer une commande. */
  async _burstTyping(jid, text) {
    const segments = splitBursts(text, this.cfg.BURST_SEGMENTS);
    if (!segments.length) return;

    const cps = Number(this.cfg.TYPE_CPS) > 0 ? Number(this.cfg.TYPE_CPS) : DEFAULT_CONFIG.TYPE_CPS;
    const raw = segments.map((segment) => Math.max(600, (segment.length / cps) * 1000));
    const total = raw.reduce((sum, value) => sum + value, 0);
    const cap = Math.max(1000, Number(this.cfg.BURST_MAX_TOTAL_MS) || 12000);
    const scale = total > cap ? cap / total : 1;

    for (let i = 0; i < segments.length; i += 1) {
      await this._presence(jid, 'composing');
      await sleep(applyJitter(raw[i] * scale, 0.2));
      await this._presence(jid, 'paused');
      if (i < segments.length - 1) await sleep(Math.round(300 + Math.random() * 900));
    }
    this.stats.bursts += 1;
    this.saveStats();
  }

  async _typingThenPause(jid, text, durationMs) {
    if (this.cfg.BURST_ENABLED && text && text.length >= this.cfg.BURST_MIN_LEN) {
      await this._burstTyping(jid, text);
      return;
    }
    await this._presence(jid, 'composing');
    await sleep(durationMs);
    await this._presence(jid, 'paused');
  }

  _transport() {
    if (this.sendFn) return this.sendFn;
    /* Chargement paresseux : évite un cycle wa-send ↔ wa-secure. */
    return require('./wa-send').send;
  }

  async _rawSend(jid, payload, opts = {}) {
    let lastError;
    const send = this._transport();

    for (let attempt = 1; attempt <= this.cfg.MAX_RETRIES; attempt += 1) {
      if (!this._isConnected()) {
        for (let wait = 0; wait < 12 && !this._isConnected(); wait += 1) await sleep(5000);
        if (!this._isConnected()) throw new Error('WaSecure NOT_CONNECTED');
      }
      try {
        /* skipQueue : la file est déjà tenue ici, on ne la double pas dans
           le transport (sinon attente mutuelle sur le même JID). */
        return await send(this.sock, jid, payload, opts, { skipQueue: true });
      } catch (e) {
        lastError = e;
        this.stats.retried += 1;
        this._log(`envoi ${attempt}/${this.cfg.MAX_RETRIES} échec:`, e.message);
        if (attempt < this.cfg.MAX_RETRIES) {
          await sleep(this.cfg.RETRY_BASE_MS * (2 ** (attempt - 1)));
        }
      }
    }

    this.stats.errors += 1;
    this.saveStats();
    throw lastError;
  }

  _checkRate() {
    const verdict = this.limiter.check();
    if (verdict.ok) return;
    this.stats.rateLimited += 1;
    this._log(`quota atteint: ${verdict.reason} (${verdict.limit})`);
    const error = new Error(`WaSecure ${verdict.reason}: limite ${verdict.limit} atteinte`);
    error.code = verdict.reason;
    throw error;
  }

  _personaBias() {
    const bias = Number(this.cfg.REACTION_BIAS);
    return Number.isFinite(bias) && bias > 0 ? bias : 1;
  }

  /** Contrôles + délai + frappe. Retourne { jid, delay }. */
  async _prepare(jid, msg, outgoing, opts = {}) {
    const target = normalizeJid(jid);
    if (!this._isAllowed(target)) throw new Error(`WaSecure BLOCKED_JID: ${target}`);
    this._checkRate();

    const incoming = this._extractIncoming(msg);
    let delay = computeDelay({ incoming, outgoing, jid: target, cfg: this.cfg });
    delay = Math.round(delay * this.warmup.multiplier() * this._personaBias());
    if (opts.skipDelay) delay = 0;

    if (msg && !isNewsletterJid(target)) await this._markRead(msg);

    if (!opts.skipTyping && delay > 0) await this._typingThenPause(target, outgoing, delay);
    else if (delay > 0) await sleep(delay);

    return { jid: target, delay };
  }

  _withQueue(jid, fn) {
    return this.queue.enqueue(jid, fn).catch((e) => {
      if (String(e?.message || '').startsWith('WaSecure QUEUE')) {
        this.stats.queueDropped += 1;
        this.saveStats();
      }
      throw e;
    });
  }

  /* ─── API publique ──────────────────────────────────────────── */

  async reply(jid, msg, text, opts = {}) {
    const finalText = String(text ?? '').slice(0, this.cfg.MAX_TEXT_LEN);
    return this._withQueue(jid, async () => {
      const { jid: target, delay } = await this._prepare(jid, msg, finalText, opts);
      const payload = { text: finalText };
      if (opts.mentions) payload.mentions = opts.mentions;
      const sendOpts = opts.quoted ? { quoted: msg } : undefined;
      this.limiter.record();
      this._trackSend(target);
      this._log(`reply → ${target} (${delay} ms)`, { length: finalText.length });
      return this._rawSend(target, payload, sendOpts);
    });
  }

  async replyMedia(jid, msg, payload, opts = {}) {
    return this._withQueue(jid, async () => {
      const { jid: target, delay } = await this._prepare(jid, msg, payload?.caption || '[média]', opts);
      const sendOpts = opts.quoted ? { quoted: msg } : undefined;
      this.limiter.record();
      this._trackSend(target);
      this._log(`replyMedia → ${target} (${delay} ms)`);
      return this._rawSend(target, payload, sendOpts);
    });
  }

  async replyUrgent(jid, msg, text, opts = {}) {
    const target = normalizeJid(jid);
    if (!this._isAllowed(target)) throw new Error(`WaSecure BLOCKED_JID: ${target}`);
    this._checkRate();
    const payload = { text: String(text ?? '').slice(0, this.cfg.MAX_TEXT_LEN) };
    if (opts.mentions) payload.mentions = opts.mentions;
    const sendOpts = opts.quoted ? { quoted: msg } : undefined;
    this.limiter.record();
    this._trackSend(target);
    this._log(`replyUrgent → ${target}`);
    return this._rawSend(target, payload, sendOpts);
  }

  async _sendPayload(jid, payload, opts = {}) {
    return this._withQueue(jid, async () => {
      const target = normalizeJid(jid);
      if (!this._isAllowed(target)) throw new Error(`WaSecure BLOCKED_JID: ${target}`);
      this._checkRate();
      const text = payload?.text || '';
      let delay = computeDelay({ jid: target, incoming: '', outgoing: text, cfg: this.cfg });
      delay = Math.round(delay * this.warmup.multiplier() * this._personaBias());
      if (opts.skipDelay) delay = 0;
      if (delay > 0 && !opts.skipTyping) await this._typingThenPause(target, text, delay);
      else if (delay > 0) await sleep(delay);
      this.limiter.record();
      this._trackSend(target);
      this._log(`send → ${target} (${delay} ms)`);
      return this._rawSend(target, payload, opts);
    });
  }

  sendToGroup(jid, payload, opts = {}) {
    return this._sendPayload(jid, payload, opts);
  }

  sendToDM(jid, payload, opts = {}) {
    return this._sendPayload(jid, payload, opts);
  }

  /**
   * Diffusion étalée sur la journée, dans les quotas.
   * @param {string[]} jids
   * @param {object|Function} payloadOrFn payload ou (jid) => payload
   */
  async broadcast(jids, payloadOrFn, opts = {}) {
    const list = Array.isArray(jids) ? jids : [];
    if (!list.length) return { ok: 0, fail: 0, errors: [] };

    const perDay = Math.max(1, Number(this.cfg.PER_DAY) || 1);
    const gapMs = Number(opts.gapMs)
      || Math.ceil(86400000 / Math.min(perDay, list.length)) + 30000;
    const results = { ok: 0, fail: 0, errors: [] };

    for (let i = 0; i < list.length; i += 1) {
      const jid = list[i];
      try {
        const payload = typeof payloadOrFn === 'function' ? payloadOrFn(jid) : payloadOrFn;
        await this.sendToDM(jid, payload, { skipTyping: true, ...opts });
        results.ok += 1;
      } catch (e) {
        results.fail += 1;
        results.errors.push({ jid, error: e.message });
        if (['RATE_MINUTE', 'RATE_HOUR', 'RATE_DAY'].includes(e.code)) break;
      }
      if (i < list.length - 1) await sleep(gapMs);
    }
    return results;
  }

  blacklistAdd(jid) {
    this.blacklist.add(normalizeJid(jid));
  }

  blacklistRemove(jid) {
    this.blacklist.delete(normalizeJid(jid));
  }

  getStats() {
    return {
      ...this.stats,
      uptimeMs: Date.now() - this.stats.startedAt,
      warmup: this.warmup.info(),
      rate: this.limiter.stats(),
      queuePending: this.queue.pendingTotal,
      limits: {
        perMinute: this.cfg.PER_MINUTE,
        perHour: this.cfg.PER_HOUR,
        perDay: this.cfg.PER_DAY,
      },
    };
  }

  stop() {
    this.limiter.stop();
    this.saveStats();
    this._log('arrêté');
  }
}

/* ─── Reconnexion avec rotation de proxy (export utilitaire) ─────
   Le dépôt possède déjà sa propre reconnexion multi-session dans
   index.js ; cette classe reste disponible pour un usage isolé. */

class Reconnector {
  constructor(startFn, cfg = {}) {
    this.startFn = startFn;
    this.backoff = cfg.backoff || DEFAULT_CONFIG.RECONNECT_BACKOFF;
    this.proxyManager = cfg.proxyManager || null;
    this.onCloseCallback = cfg.onClose || null;
    this.attempt = 0;
    this.timer = null;
    this.stopped = false;
  }

  schedule() {
    if (this.stopped) return;
    const delay = this.backoff[Math.min(this.attempt, this.backoff.length - 1)];
    console.log(`[WA-RECONNECT] tentative ${this.attempt + 1} dans ${delay} ms`);
    this.timer = setTimeout(async () => {
      try {
        this.attempt += 1;
        const agentOptions = this.proxyManager ? this.proxyManager.getSocketAgents() : {};
        await this.startFn(agentOptions);
        this.attempt = 0;
        if (this.proxyManager) this.proxyManager.markSuccess(this.proxyManager.currentUrl());
        console.log('[WA-RECONNECT] connexion réussie');
      } catch (e) {
        console.error('[WA-RECONNECT] échec:', e.message);
        if (this.proxyManager) this.proxyManager.markFailure(this.proxyManager.currentUrl());
        this.schedule();
      }
    }, delay);
    if (this.timer.unref) this.timer.unref();
  }

  onClose(code) {
    if (this.onCloseCallback) {
      try { this.onCloseCallback(code); } catch { /* ignoré */ }
    }
    if (code === 401) {
      console.log('[WA-RECONNECT] session invalide (401) — reconnexion manuelle requise');
      return;
    }
    if (code === 403) {
      console.log('[WA-RECONNECT] compte banni (403) — arrêt');
      this.stopped = true;
      return;
    }
    this.schedule();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

module.exports = {
  WaSecure,
  Reconnector,
  RateLimiter,
  Warmup,
  JidQueue,
  DEFAULT_CONFIG,
  computeDelay,
  splitBursts,
  normalizeJid,
  sleep,
};
