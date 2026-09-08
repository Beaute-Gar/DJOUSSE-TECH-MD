import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawAll } from '../../infrastructure/database/database.js';

const log = createLogger('TRACER');

class TraceSpan {
  constructor(span) {
    Object.assign(this, span);
    this.children = [];
    this.startedAt = Date.now();
  }

  end() { this.duration = Date.now() - this.startedAt; }

  toJSON() {
    return {
      id: this.id, traceId: this.traceId, parentId: this.parentId,
      operation: this.operation, status: this.status,
      duration: this.duration, error: this.error,
      model: this.model, tool: this.tool, agent: this.agent,
      memoryCount: this.memoryCount, permission: this.permission,
      timestamp: this.timestamp,
      children: this.children.map(c => c.toJSON()),
    };
  }
}

export class Tracer {
  constructor() {
    this.traces = new Map();
    this.activeSpans = new Map();
    this.maxTraces = 200;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    try {
      rawRun(`CREATE TABLE IF NOT EXISTS ainoria_traces (
        id TEXT PRIMARY KEY, trace_id TEXT NOT NULL, parent_id TEXT,
        operation TEXT NOT NULL, status TEXT, duration INTEGER,
        model TEXT, tool TEXT, agent TEXT, memory_count INTEGER,
        permission TEXT, error TEXT, metadata TEXT DEFAULT '{}',
        timestamp INTEGER NOT NULL
      )`);
      rawRun(`CREATE INDEX IF NOT EXISTS idx_traces_trace_id ON ainoria_traces(trace_id)`);
      rawRun(`CREATE INDEX IF NOT EXISTS idx_traces_operation ON ainoria_traces(operation)`);
      rawRun(`CREATE INDEX IF NOT EXISTS idx_traces_timestamp ON ainoria_traces(timestamp)`);
      this.initialized = true;
    } catch (err) { log.warn(`Tracer init: ${err.message}`); }
  }

  startTrace(operation, opts = {}) {
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const span = new TraceSpan({
      id: traceId, traceId, parentId: null,
      operation, status: 'started',
      model: opts.model || null, tool: opts.tool || null,
      agent: opts.agent || null, permission: opts.permission || null,
      error: null, timestamp: Date.now(),
    });
    this.traces.set(traceId, span);
    this.activeSpans.set(traceId, span);
    return span;
  }

  startSpan(parentTraceId, operation, opts = {}) {
    const parent = this.traces.get(parentTraceId) || this.activeSpans.get(parentTraceId);
    if (!parent) return this.startTrace(operation, opts);

    const spanId = `span_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const span = new TraceSpan({
      id: spanId, traceId: parent.traceId, parentId: parent.id,
      operation, status: 'started',
      model: opts.model || null, tool: opts.tool || null,
      agent: opts.agent || null, permission: opts.permission || null,
      error: null, timestamp: Date.now(),
    });
    parent.children.push(span);
    this.activeSpans.set(spanId, span);
    return span;
  }

  endSpan(spanId, status = 'completed', opts = {}) {
    const span = this.activeSpans.get(spanId);
    if (!span) return;
    span.end();
    span.status = status;
    if (opts.error) span.error = opts.error;
    if (opts.model) span.model = opts.model;
    if (opts.tool) span.tool = opts.tool;
    if (opts.agent) span.agent = opts.agent;
    if (opts.memoryCount !== undefined) span.memoryCount = opts.memoryCount;
    if (opts.permission) span.permission = opts.permission;
    this.activeSpans.delete(spanId);

    this._persist(span);
  }

  endTrace(traceId, status = 'completed', opts = {}) {
    const trace = this.traces.get(traceId);
    if (!trace) return;
    trace.end();
    trace.status = status;
    if (opts.error) trace.error = opts.error;
    this._persist(trace);
    if (this.traces.size > this.maxTraces) {
      const oldest = this.traces.keys().next().value;
      this.traces.delete(oldest);
    }
  }

  _persist(span) {
    try {
      rawRun('INSERT INTO ainoria_traces (id, trace_id, parent_id, operation, status, duration, model, tool, agent, memory_count, permission, error, metadata, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        span.id, span.traceId, span.parentId, span.operation, span.status, span.duration,
        span.model, span.tool, span.agent, span.memoryCount, span.permission,
        span.error ? span.error.slice(0, 500) : null, '{}', span.timestamp);
    } catch {}
  }

  getTrace(traceId) {
    return this.traces.get(traceId) || null;
  }

  getRecentTraces(limit = 20) {
    try {
      return rawAll('SELECT * FROM ainoria_traces WHERE parent_id IS NULL ORDER BY timestamp DESC LIMIT ?', limit);
    } catch { return []; }
  }

  getSpansForTrace(traceId) {
    try {
      return rawAll('SELECT * FROM ainoria_traces WHERE trace_id = ? AND parent_id IS NOT NULL ORDER BY timestamp ASC', traceId);
    } catch { return []; }
  }

  getStats() {
    try {
      const total = rawAll('SELECT COUNT(*) as c, COALESCE(AVG(duration), 0) as avg_dur, operation FROM ainoria_traces GROUP BY operation ORDER BY c DESC LIMIT 20');
      const errors = rawAll("SELECT COUNT(*) as c FROM ainoria_traces WHERE status = 'error'")[0]?.c || 0;
      const totalAll = rawAll('SELECT COUNT(*) as c FROM ainoria_traces')[0]?.c || 0;
      return { total: totalAll, errors, avgDuration: Math.round(total.reduce((s, r) => s + r.avg_dur, 0) / Math.max(total.length, 1)), byOperation: total.map(r => ({ op: r.operation, count: r.c })) };
    } catch { return { total: 0, errors: 0, avgDuration: 0, byOperation: [] }; }
  }

  async traceOperation(operation, fn, opts = {}) {
    const trace = this.startTrace(operation, opts);
    try {
      const result = await fn(trace);
      this.endTrace(trace.id, 'completed');
      return result;
    } catch (err) {
      this.endTrace(trace.id, 'error', { error: err.message });
      throw err;
    }
  }
}

export const tracer = new Tracer();
export default tracer;
