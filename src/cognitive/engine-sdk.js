import { createLogger } from '../core/logger.js';
import { bus } from './event-bus.js';

const log = createLogger('SDK');

/* ════════════════════════════════════════════════════════════
   Engine Registry — catalogue global des moteurs cognitifs
════════════════════════════════════════════════════════════ */

class EngineRegistry {
  constructor() {
    this.engines = new Map();
    this._metrics = {};
    this._startTime = Date.now();
  }

  register(engine) {
    if (this.engines.has(engine.name)) {
      log.warn(`[SDK] Moteur "${engine.name}" deja enregistre, remplacement`);
    }
    this.engines.set(engine.name, engine);
    this._metrics[engine.name] = { calls: 0, errors: 0, totalMs: 0, lastCall: null };
    log.info(`[SDK] Moteur enregistre: ${engine.name} v${engine.version || '1.0'}`);
    bus.emit('engine:registered', { name: engine.name, version: engine.version, capabilities: engine.capabilities });
    return this;
  }

  get(name) {
    return this.engines.get(name) || null;
  }

  list() {
    return Array.from(this.engines.values()).map(e => ({
      name: e.name,
      version: e.version,
      capabilities: e.capabilities || [],
      status: e.status ? e.status() : 'unknown',
      metrics: this._metrics[e.name] || { calls: 0, errors: 0 },
    }));
  }

  async call(name, method, ...args) {
    const engine = this.engines.get(name);
    if (!engine) throw new Error(`Engine inconnu: ${name}`);
    if (!engine[method]) throw new Error(`Methode ${method} introuvable sur ${name}`);
    const start = Date.now();
    const metric = this._metrics[name];
    try {
      const result = await engine[method](...args);
      metric.calls++;
      metric.totalMs += Date.now() - start;
      metric.lastCall = Date.now();
      return result;
    } catch (err) {
      metric.errors++;
      log.error(`[SDK] Erreur ${name}.${method}: ${err.message}`);
      throw err;
    }
  }

  getMetrics(name = null) {
    if (name) return this._metrics[name] || null;
    const result = {};
    for (const [k, v] of Object.entries(this._metrics)) {
      result[k] = { ...v, avgMs: v.calls > 0 ? Math.round(v.totalMs / v.calls) : 0 };
    }
    return result;
  }

  health() {
    const results = {};
    for (const [name, engine] of this.engines) {
      try {
        const h = typeof engine.health === 'function' ? engine.health() : { status: 'ok' };
        results[name] = h;
      } catch {
        results[name] = { status: 'error', message: 'Health check failed' };
      }
    }
    const okCount = Object.values(results).filter(r => r.status === 'ok').length;
    return {
      status: okCount === this.engines.size ? 'healthy' : 'degraded',
      uptime: Date.now() - this._startTime,
      engines: results,
      metrics: this.getMetrics(),
    };
  }

  summary() {
    const engines = this.list();
    const healthy = engines.filter(e => e.status === 'ok').length;
    return `[EngineRegistry] ${engines.length} moteurs, ${healthy} sains\n` +
      engines.map(e => `  ${e.name.padEnd(20)} v${e.version || '?'} [${e.capabilities.join(', ')}]`).join('\n');
  }
}

export const registry = new EngineRegistry();

/* ════════════════════════════════════════════════════════════
   EngineSDK — classe de base pour tous les moteurs
════════════════════════════════════════════════════════════ */

export class EngineSDK {
  constructor(config = {}) {
    this.name = config.name || this.constructor.name;
    this.version = config.version || '1.0.0';
    this._capabilities = config.capabilities || [];
    this._dependencies = config.dependencies || [];
    this._onInit = config.onInit || null;
    this._onDestroy = config.onDestroy || null;
    this._initialized = false;
    this._subs = [];
  }

  get capabilities() { return this._capabilities; }

  async init() {
    if (this._initialized) return;
    if (this._onInit) await this._onInit();
    this._initialized = true;
    registry.register(this);
    bus.emit('engine:init', { name: this.name, version: this.version });
    log.info(`[ENGINE:${this.name}] Initialise v${this.version}`);
  }

  async destroy() {
    if (!this._initialized) return;
    for (const unsub of this._subs) unsub();
    this._subs = [];
    if (this._onDestroy) await this._onDestroy();
    this._initialized = false;
    log.info(`[ENGINE:${this.name}] Detruit`);
  }

  subscribe(event, handler) {
    const unsub = bus.on(event, handler);
    this._subs.push(unsub);
    return unsub;
  }

  health() {
    return { status: this._initialized ? 'ok' : 'not_initialized', version: this.version };
  }

  status() {
    return this._initialized ? 'ok' : 'inactive';
  }

  version() {
    return this.version;
  }

  static wrap(config, methods) {
    const sdk = new EngineSDK(config);
    for (const [key, fn] of Object.entries(methods)) sdk[key] = fn.bind(sdk);
    return sdk;
  }
}

export default EngineSDK;
