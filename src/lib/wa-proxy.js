'use strict';
/**
 * wa-proxy.js — rotation et santé des proxies pour Baileys
 * ─────────────────────────────────────────────────────────────────
 * Gère une liste de proxies HTTP(S) et SOCKS4/5, choisit le prochain
 * selon la stratégie demandée, exclut temporairement ceux qui échouent
 * et persiste l'index + l'état de santé sur disque.
 *
 * Les agents produits sont compatibles Baileys 6.x :
 *   makeWASocket({ agent, fetchAgent })
 *     - agent      : connexion WebSocket principale ;
 *     - fetchAgent : téléchargements/envois de médias (CDN WhatsApp).
 *
 * Dépendances OPTIONNELLES : socks-proxy-agent / https-proxy-agent.
 * Sans elles (ou sans proxy configuré) le bot se connecte en direct :
 * aucun crash, seulement un avertissement au premier usage.
 *
 * Aucun listener Baileys n'est installé ici.
 */

const fs = require('fs');
const net = require('net');
const path = require('path');

const STRATEGIES = {
  ROUND_ROBIN: 'round_robin',
  RANDOM: 'random',
  STICKY: 'sticky',
};

/* Charge les agents à la demande : une installation sans proxy n'a pas
   besoin de ces paquets, et une dépendance absente ne doit pas empêcher
   le bot de démarrer. */
let agentModules;
function loadAgentModules() {
  if (agentModules) return agentModules;
  agentModules = { SocksProxyAgent: null, HttpsProxyAgent: null };
  try {
    agentModules.SocksProxyAgent = require('socks-proxy-agent').SocksProxyAgent;
  } catch {
    /* optionnel */
  }
  try {
    agentModules.HttpsProxyAgent = require('https-proxy-agent').HttpsProxyAgent;
  } catch {
    /* optionnel */
  }
  return agentModules;
}

function ensureDir(file) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  } catch {
    /* non bloquant */
  }
}

class ProxyManager {
  /**
   * @param {object} opts
   * @param {string[]|object[]} [opts.proxies] URL ou { url, weight }
   * @param {string} [opts.strategy]           round_robin | random | sticky
   * @param {string} [opts.stateFile]          persistance index + santé
   * @param {number} [opts.failThreshold]      échecs avant exclusion
   * @param {boolean} [opts.verbose]
   */
  constructor(opts = {}) {
    this.proxies = (opts.proxies || []).map((entry, index) => {
      const url = typeof entry === 'string' ? entry : entry?.url;
      if (!url) throw new Error(`Proxy #${index} : URL manquante`);
      return {
        url: String(url).trim(),
        weight: Math.max(1, Number(entry?.weight) || 1),
        index,
      };
    });
    this.strategy = Object.values(STRATEGIES).includes(opts.strategy)
      ? opts.strategy
      : STRATEGIES.ROUND_ROBIN;
    this.stateFile = opts.stateFile || null;
    this.failThreshold = Math.max(1, Number(opts.failThreshold) || 3);
    this.verbose = !!opts.verbose;
    this.rrIndex = 0;
    this.stickyUrl = null;
    this.currentProxy = null;
    this.health = new Map(); // url → { fails, successes, lastCheck, blockedUntil }
    this.healthTimer = null;
    this._loadState();
  }

  get enabled() {
    return this.proxies.length > 0;
  }

  /* ─── Persistance ────────────────────────────────────────────── */

  _loadState() {
    if (!this.stateFile) return;
    try {
      if (!fs.existsSync(this.stateFile)) return;
      const saved = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      this.rrIndex = Number(saved.rrIndex) || 0;
      this.stickyUrl = saved.stickyUrl || null;
      for (const [url, health] of Object.entries(saved.health || {})) {
        this.health.set(url, {
          fails: Number(health?.fails) || 0,
          successes: Number(health?.successes) || 0,
          lastCheck: Number(health?.lastCheck) || 0,
          blockedUntil: Number(health?.blockedUntil) || 0,
        });
      }
      if (this.verbose) console.log('[WA-PROXY] état restauré depuis', this.stateFile);
    } catch (e) {
      console.error('[WA-PROXY] restauration échouée:', e.message);
    }
  }

  saveState() {
    if (!this.stateFile) return;
    try {
      ensureDir(this.stateFile);
      const tmp = `${this.stateFile}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({
        rrIndex: this.rrIndex,
        stickyUrl: this.stickyUrl,
        health: Object.fromEntries(this.health),
      }, null, 2));
      fs.renameSync(tmp, this.stateFile);
    } catch (e) {
      console.error('[WA-PROXY] sauvegarde échouée:', e.message);
    }
  }

  /* ─── Sélection ──────────────────────────────────────────────── */

  _state(url) {
    if (!this.health.has(url)) {
      this.health.set(url, { fails: 0, successes: 0, lastCheck: 0, blockedUntil: 0 });
    }
    return this.health.get(url);
  }

  isBlocked(url) {
    return this._state(url).blockedUntil > Date.now();
  }

  get available() {
    return this.proxies.filter((p) => !this.isBlocked(p.url));
  }

  _weightedPick(pool) {
    const total = pool.reduce((sum, p) => sum + p.weight, 0);
    let roll = Math.random() * total;
    for (const p of pool) {
      roll -= p.weight;
      if (roll <= 0) return p;
    }
    return pool[0];
  }

  /**
   * Retourne le prochain proxy utilisable.
   * @param {boolean} [advance] avancer le round-robin (true à chaque connexion)
   */
  pick(advance = false) {
    if (!this.proxies.length) return null;
    const pool = this.available.length ? this.available : this.proxies;
    if (!this.available.length) {
      console.warn('[WA-PROXY] tous les proxies sont bloqués — repli temporaire');
    }

    let chosen;
    if (this.strategy === STRATEGIES.RANDOM) {
      chosen = this._weightedPick(pool);
    } else if (this.strategy === STRATEGIES.STICKY) {
      const sticky = this.stickyUrl && pool.find((p) => p.url === this.stickyUrl);
      chosen = sticky || pool[this.rrIndex % pool.length];
      if (chosen.url !== this.stickyUrl) {
        this.stickyUrl = chosen.url;
        this.saveState();
      }
    } else {
      chosen = pool[this.rrIndex % pool.length];
      if (advance) {
        this.rrIndex = (this.rrIndex + 1) % pool.length;
        this.saveState();
      }
    }

    this.currentProxy = chosen.url;
    return chosen;
  }

  /* ─── Agents Baileys ────────────────────────────────────────── */

  _agentFor(url) {
    const protocol = String(url).toLowerCase();
    const socks = protocol.startsWith('socks4://')
      || protocol.startsWith('socks5://')
      || protocol.startsWith('socks://');
    const { SocksProxyAgent, HttpsProxyAgent } = loadAgentModules();
    if (socks) {
      if (!SocksProxyAgent) throw new Error('socks-proxy-agent non installé');
      return new SocksProxyAgent(url);
    }
    if (!HttpsProxyAgent) throw new Error('https-proxy-agent non installé');
    return new HttpsProxyAgent(url);
  }

  /**
   * Agents prêts pour makeWASocket({ agent, fetchAgent }).
   * Retourne {} si aucun proxy n'est configuré/possible (connexion directe).
   */
  getSocketAgents() {
    if (!this.proxies.length) return {};
    const proxy = this.pick(true);
    if (!proxy) return {};
    try {
      const agent = this._agentFor(proxy.url);
      if (this.verbose) console.log('[WA-PROXY] connexion via', proxy.url);
      return { agent, fetchAgent: agent };
    } catch (e) {
      console.error('[WA-PROXY] agent indisponible:', e.message);
      return {};
    }
  }

  currentUrl() {
    return this.currentProxy || this.pick(false)?.url || null;
  }

  /* ─── Santé ─────────────────────────────────────────────────── */

  markSuccess(url) {
    const target = url || this.currentProxy || this.stickyUrl;
    if (!target) return;
    const health = this._state(target);
    health.successes += 1;
    health.fails = 0;
    health.blockedUntil = 0;
    health.lastCheck = Date.now();
    this.saveState();
  }

  markFailure(url, blockMs = 5 * 60 * 1000) {
    const target = url || this.currentProxy || this.stickyUrl;
    if (!target) return;
    const health = this._state(target);
    health.fails += 1;
    health.lastCheck = Date.now();
    if (health.fails >= this.failThreshold) {
      health.blockedUntil = Date.now() + blockMs;
      console.warn(`[WA-PROXY] ${target} exclu ${Math.round(blockMs / 1000)} s (${health.fails} échecs)`);
    }
    this.saveState();
  }

  /** Vérifie chaque proxy ; exclut les morts 10 minutes. */
  async checkAll(timeoutMs = 8000) {
    const results = [];
    for (const proxy of this.proxies) {
      const result = await this._checkOne(proxy.url, timeoutMs);
      results.push({ url: proxy.url, ok: result.ok, error: result.error });
      if (result.ok) this.markSuccess(proxy.url);
      else this.markFailure(proxy.url, 10 * 60 * 1000);
    }
    return results;
  }

  _checkOne(url, timeoutMs) {
    return new Promise((resolve) => {
      let parsed;
      try {
        parsed = new URL(url);
      } catch (e) {
        resolve({ ok: false, error: `URL invalide: ${e.message}` });
        return;
      }

      const isSocks = parsed.protocol.startsWith('socks');
      const port = Number(parsed.port) || (isSocks ? 1080 : 8080);
      const socket = net.connect({ host: parsed.hostname, port, timeout: timeoutMs });
      let settled = false;
      let onData = null;

      const done = (ok, error) => {
        if (settled) return;
        settled = true;
        if (onData) socket.off('data', onData);
        socket.destroy();
        resolve({ ok, error: error || null });
      };

      socket.setTimeout(timeoutMs);
      socket.once('timeout', () => done(false, 'timeout'));
      socket.once('error', (e) => done(false, e.message));
      socket.once('connect', () => {
        /* SOCKS : sans poignée de main complète, un TCP ouvert prouve au
           moins que le proxy écoute. HTTP : on teste un vrai CONNECT. */
        if (isSocks) {
          done(true, null);
          return;
        }

        let buffer = '';
        onData = (chunk) => {
          buffer += chunk.toString();
          if (buffer.includes('\r\n\r\n')) {
            done(buffer.includes(' 200 '), `HTTP ${buffer.split('\r\n')[0]}`);
          }
        };
        socket.on('data', onData);

        const auth = parsed.username
          ? `Proxy-Authorization: Basic ${Buffer.from(
            `${decodeURIComponent(parsed.username)}:${decodeURIComponent(parsed.password || '')}`,
          ).toString('base64')}\r\n`
          : '';
        socket.write(
          'CONNECT web.whatsapp.com:443 HTTP/1.1\r\n'
          + 'Host: web.whatsapp.com:443\r\n'
          + `${auth}\r\n`,
        );
      });
    });
  }

  startHealthLoop(intervalMs = 10 * 60 * 1000) {
    if (this.healthTimer) clearInterval(this.healthTimer);
    if (!this.proxies.length) return;
    this.healthTimer = setInterval(() => this.checkAll().catch(() => {}), intervalMs);
    if (this.healthTimer.unref) this.healthTimer.unref();
  }

  stop() {
    if (this.healthTimer) clearInterval(this.healthTimer);
    this.healthTimer = null;
    this.saveState();
  }

  stats() {
    return {
      total: this.proxies.length,
      available: this.available.length,
      strategy: this.strategy,
      current: this.currentProxy,
      health: Object.fromEntries(this.health),
    };
  }
}

module.exports = { ProxyManager, STRATEGIES };
