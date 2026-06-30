import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';
import { rawGet, rawRun, rawAll } from '../lib/database.js';
import { registry } from './engine-sdk.js';

const log = createLogger('CRT');

/* ════════════════════════════════════════════════════════════
   ENGINE DEPENDENCY GRAPH
════════════════════════════════════════════════════════════ */

const ENGINE_DEPENDENCIES = {
  identity: [],
  context: ['identity'],
  memory: [],
  knowledge_graph: ['identity'],
  world_model: ['identity', 'memory', 'knowledge_graph'],
  digital_twin: ['identity', 'memory'],
  decision: ['context', 'identity'],
  automation: ['decision'],
  ai_orchestrator: ['context', 'memory'],
  reasoning: ['context', 'knowledge_graph', 'memory'],
  goal_memory: ['reasoning'],
  planning: ['world_model', 'reasoning', 'goal_memory'],
  foresight: ['planning', 'reasoning', 'digital_twin', 'world_model'],
  semantic_memory: ['identity', 'knowledge_graph', 'memory', 'goal_memory', 'planning', 'foresight'],
  meta_cognition: ['reasoning', 'foresight', 'semantic_memory'],
};

const PRIORITY_LEVELS = { critical: 0, high: 1, normal: 2, low: 3, background: 4 };
const PRIORITY_LABELS = ['critical', 'high', 'normal', 'low', 'background'];

const AI_MODELS = {
  fast: { name: 'gemini-1.5-flash', costPerCall: 1, maxTokens: 8192, suitableFor: ['classification', 'extraction', 'summarization'] },
  balanced: { name: 'gemini-2.0-flash', costPerCall: 3, maxTokens: 16384, suitableFor: ['reasoning', 'planning', 'analysis'] },
  deep: { name: 'gemini-2.0-pro', costPerCall: 10, maxTokens: 65536, suitableFor: ['complex_reasoning', 'code_generation', 'long_context'] },
};

/* ════════════════════════════════════════════════════════════
   COGNITIVE RUNTIME
════════════════════════════════════════════════════════════ */

export class CognitiveRuntime {
  constructor() {
    this._engines = new Map();
    this._running = new Map();
    this._queues = { critical: [], high: [], normal: [], low: [], background: [] };
    this._active = 0;
    this._maxConcurrent = 5;
    this._startTime = Date.now();
    this._aiBudget = { daily: 100, used: 0, resetAt: Date.now() + 86400000 };
    this._metrics = { totalRuns: 0, totalErrors: 0, totalMs: 0, byEngine: {} };
    this._health = { status: 'starting', lastCheck: Date.now(), engines: {}, memory: {} };
    this._running = false;
  }

  /* ── Engine Lifecycle ──────────────────────────────────── */
  registerEngine(config) {
    const engine = {
      name: config.name,
      version: config.version || '1.0',
      dependencies: config.dependencies || ENGINE_DEPENDENCIES[config.name] || [],
      priorities: config.priorities || {},
      handler: config.handler || null,
      status: 'registered',
      startedAt: null,
      metrics: { calls: 0, errors: 0, totalMs: 0, lastCall: null },
    };
    this._engines.set(config.name, engine);
    log.info(`[CRT] Moteur enregistre: ${config.name} v${engine.version}`);
    return engine;
  }

  async startEngine(name) {
    const engine = this._engines.get(name);
    if (!engine) throw new Error(`Moteur inconnu: ${name}`);
    if (engine.status === 'running') return;
    for (const dep of engine.dependencies) {
      const depEngine = this._engines.get(dep);
      if (!depEngine || depEngine.status !== 'running') {
        log.warn(`[CRT] Demarrage de ${dep} requis par ${name}`);
        await this.startEngine(dep);
      }
    }
    engine.status = 'running';
    engine.startedAt = Date.now();
    log.info(`[CRT] Moteur demarre: ${name}`);
    this._health.engines[name] = { status: 'running', uptime: 0, lastHeartbeat: Date.now() };
  }

  async stopEngine(name) {
    const engine = this._engines.get(name);
    if (!engine) return;
    engine.status = 'stopped';
    this._health.engines[name] = { status: 'stopped', uptime: Date.now() - (engine.startedAt || Date.now()) };
    log.info(`[CRT] Moteur arrete: ${name}`);
  }

  async reloadEngine(name) {
    await this.stopEngine(name);
    await this.startEngine(name);
  }

  getEngine(name) { return this._engines.get(name) || null; }

  listEngines() {
    return Array.from(this._engines.values()).map(e => ({
      name: e.name, version: e.version, status: e.status,
      dependencies: e.dependencies, uptime: e.startedAt ? Date.now() - e.startedAt : 0,
      metrics: e.metrics,
    }));
  }

  getEngineDependencies(name) {
    const engine = this._engines.get(name);
    if (!engine) return null;
    const resolved = [];
    const visit = (n) => {
      const deps = ENGINE_DEPENDENCIES[n] || [];
      for (const d of deps) { resolved.push(d); visit(d); }
    };
    visit(name);
    return [...new Set(resolved)];
  }

  /* ── Scheduler ─────────────────────────────────────────── */
  async schedule(event, context = {}) {
    const priority = this._resolvePriority(event);
    const entry = { event, context, priority, queuedAt: Date.now(), engine: null };
    this._queues[priority].push(entry);
    log.info(`[CRT] Evenement planifie: ${event.type || event} (${priority})`);
    setImmediate(() => this._processQueue());
    return entry;
  }

  _resolvePriority(event) {
    const type = event.type || event;
    if (type.includes('error') || type.includes('critical') || type.includes('ban')) return 'critical';
    if (type.includes('command') || type.includes('decision') || type.includes('payment')) return 'high';
    if (type.includes('message') || type.includes('update') || type.includes('mission')) return 'normal';
    if (type.includes('analytics') || type.includes('trend')) return 'low';
    return 'background';
  }

  async _processQueue() {
    if (this._running) return;
    this._running = true;
    while (this._active < this._maxConcurrent) {
      let entry = null;
      for (const level of PRIORITY_LABELS) {
        if (this._queues[level].length > 0) { entry = this._queues[level].shift(); break; }
      }
      if (!entry) break;
      this._execute(entry);
    }
    this._running = false;
  }

  async _execute(entry) {
    this._active++;
    const start = Date.now();
    try {
      const engines = this._resolveEngines(entry.event);
      const parallel = engines.filter(e => e.dependencies.length === 0 || e.dependencies.every(d => engines.indexOf(this._engines.get(d)) < engines.indexOf(e)));
      const sequential = engines.filter(e => !parallel.includes(e));
      for (const engine of [...parallel, ...sequential]) {
        if (engine.status !== 'running') continue;
        if (!this._checkAIBudget(entry)) continue;
        const eStart = Date.now();
        try {
          if (engine.handler) await engine.handler(entry.event, entry.context);
          engine.metrics.calls++;
          engine.metrics.totalMs += Date.now() - eStart;
          engine.metrics.lastCall = Date.now();
        } catch (err) {
          engine.metrics.errors++;
          log.error(`[CRT] Erreur ${engine.name}: ${err.message}`);
        }
      }
    } catch (err) {
      log.error(`[CRT] Execution echouee: ${err.message}`);
    }
    this._active--;
    this._metrics.totalRuns++;
    this._metrics.totalMs += Date.now() - start;
    this._recordMetric(entry.event.type || 'unknown', Date.now() - start, false);
    setImmediate(() => this._processQueue());
  }

  _resolveEngines(event) {
    const type = event.type || event;
    const candidates = [];
    for (const [name, engine] of this._engines) {
      if (engine.priorities[type] || engine.priorities['*']) candidates.push(engine);
    }
    if (candidates.length === 0) {
      if (type.includes('message')) {
        for (const name of ['identity', 'context', 'memory', 'semantic_memory']) {
          const e = this._engines.get(name);
          if (e && e.status === 'running') candidates.push(e);
        }
      }
    }
    return candidates;
  }

  /* ── AI Budget Manager ─────────────────────────────────── */
  _checkAIBudget(entry) {
    if (Date.now() > this._aiBudget.resetAt) {
      this._aiBudget.used = 0;
      this._aiBudget.resetAt = Date.now() + 86400000;
    }
    const estimatedCost = entry.priority === 'critical' ? 3 : entry.priority === 'high' ? 2 : 1;
    if (this._aiBudget.used + estimatedCost > this._aiBudget.daily) return false;
    this._aiBudget.used += estimatedCost;
    return true;
  }

  getAIBudget() {
    return {
      daily: this._aiBudget.daily,
      used: this._aiBudget.used,
      remaining: Math.max(0, this._aiBudget.daily - this._aiBudget.used),
      resetAt: this._aiBudget.resetAt,
      resetIn: Math.round((this._aiBudget.resetAt - Date.now()) / 60000) + 'min',
    };
  }

  selectModel(task) {
    const complexity = task.complexity || task.length || 0;
    if (complexity > 5000) return AI_MODELS.deep;
    if (complexity > 1000) return AI_MODELS.balanced;
    return AI_MODELS.fast;
  }

  /* ── Cache Manager ─────────────────────────────────────── */
  async cacheGet(key) {
    const row = rawGet('SELECT * FROM cognitive_cache WHERE key = ? AND expires_at > ?', key, Date.now());
    if (row) { rawRun('UPDATE cognitive_cache SET hits = hits + 1 WHERE key = ?', key); }
    return row ? tryParse(row.value, null) : null;
  }

  async cacheSet(key, value, ttlMs = 300000) {
    rawRun(`INSERT OR REPLACE INTO cognitive_cache (key, value, expires_at, hits, created_at)
      VALUES (?, ?, ?, 0, ?)`, key, JSON.stringify(value), Date.now() + ttlMs, Date.now());
  }

  cacheInvalidate(pattern) {
    rawRun("DELETE FROM cognitive_cache WHERE key LIKE ?", `%${pattern}%`);
  }

  cacheStats() {
    const r = rawGet('SELECT COUNT(*) as total, SUM(hits) as totalHits FROM cognitive_cache');
    return { total: r?.total || 0, totalHits: r?.totalHits || 0 };
  }

  /* ── Health Monitor ────────────────────────────────────── */
  checkHealth() {
    const now = Date.now();
    for (const [name, engine] of this._engines) {
      const h = this._health.engines[name] || {};
      h.status = engine.status;
      h.uptime = engine.startedAt ? now - engine.startedAt : 0;
      h.lastHeartbeat = now;
      h.metrics = engine.metrics;
      this._health.engines[name] = h;
    }
    this._health.status = this._engines.size > 0 && Array.from(this._engines.values()).every(e => e.status === 'running') ? 'healthy' : 'degraded';
    this._health.lastCheck = now;
    this._health.memory = process.memoryUsage ? { rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB' } : {};
    this._health.uptime = now - this._startTime;
    return this._health;
  }

  getHealth() { return this.checkHealth(); }

  /* ── Parallel Execution ────────────────────────────────── */
  async parallel(tasks) {
    return Promise.allSettled(tasks.map(t => {
      const engine = this._engines.get(t.engine);
      if (!engine || !engine.handler) return Promise.resolve(null);
      return engine.handler(t.event, t.context || {});
    }));
  }

  /* ── Metrics Collector ─────────────────────────────────── */
  _recordMetric(type, duration, isError) {
    if (!this._metrics.byEngine[type]) this._metrics.byEngine[type] = { calls: 0, errors: 0, totalMs: 0 };
    this._metrics.byEngine[type].calls++;
    if (isError) this._metrics.byEngine[type].errors++;
    this._metrics.byEngine[type].totalMs += duration;
  }

  getMetrics() {
    const result = {};
    for (const [type, data] of Object.entries(this._metrics.byEngine)) {
      result[type] = { ...data, avgMs: data.calls > 0 ? Math.round(data.totalMs / data.calls) : 0 };
    }
    return {
      global: { totalRuns: this._metrics.totalRuns, totalErrors: this._metrics.totalErrors, uptime: Date.now() - this._startTime },
      byEngine: result,
      aiBudget: this.getAIBudget(),
      cache: this.cacheStats(),
      queue: Object.fromEntries(Object.entries(this._queues).map(([k, v]) => [k, v.length])),
      active: this._active,
    };
  }

  /* ── Observability ─────────────────────────────────────── */
  on(event, handler) {
    bus.on(event, async (data) => {
      await this.schedule(event, data);
      if (handler) handler(data);
    });
  }
}

function tryParse(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

export const runtime = new CognitiveRuntime();
export { ENGINE_DEPENDENCIES, PRIORITY_LEVELS, AI_MODELS };
export default runtime;
