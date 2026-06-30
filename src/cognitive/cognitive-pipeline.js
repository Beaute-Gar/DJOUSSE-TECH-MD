import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';
import { clock } from './cognitive-clock.js';

const log = createLogger('PIPELINE');

class CognitivePipeline {
  constructor() {
    this._handlers = new Map();
    this._lifecycleTraces = [];
  }

  on(eventType, handler, { priority = 0, description = '' } = {}) {
    if (!this._handlers.has(eventType)) this._handlers.set(eventType, []);
    this._handlers.get(eventType).push({ handler, priority, description });
    this._handlers.get(eventType).sort((a, b) => b.priority - a.priority);
  }

  off(eventType, handler) {
    const handlers = this._handlers.get(eventType);
    if (!handlers) return;
    const idx = handlers.findIndex(h => h.handler === handler);
    if (idx !== -1) handlers.splice(idx, 1);
  }

  async dispatch(eventType, data) {
    const handlers = this._handlers.get(eventType) || [];
    const wildcardHandlers = this._handlers.get('*') || [];
    const allHandlers = [...handlers, ...wildcardHandlers].sort((a, b) => b.priority - a.priority);

    if (allHandlers.length === 0) return [];

    const results = [];
    for (const { handler, description } of allHandlers) {
      try {
        const trace = this._lifecycleStart(eventType, description, data);
        const result = await handler(data, eventType);
        this._lifecycleEnd(trace, result);
        results.push({ handler: description || 'anonymous', result, error: null });
      } catch (err) {
        log.error(`[PIPELINE] ${description || 'handler'} for ${eventType}: ${err.message}`);
        results.push({ handler: description || 'anonymous', result: null, error: err.message });
      }
    }
    return results;
  }

  removeAll(eventType) {
    if (eventType) this._handlers.delete(eventType);
    else this._handlers.clear();
  }

  getHandlers(eventType) {
    if (eventType) return this._handlers.get(eventType) || [];
    const all = {};
    for (const [type, handlers] of this._handlers) {
      all[type] = handlers.map(h => ({ description: h.description, priority: h.priority }));
    }
    return all;
  }

  _lifecycleStart(eventType, description, data) {
    const trace = {
      id: `lc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      eventType,
      handler: description || 'anonymous',
      input: data,
      startedAt: clock.now(),
      stages: [
        { name: 'observe', at: clock.now() },
        { name: 'understand', at: null },
        { name: 'remember', at: null },
        { name: 'reason', at: null },
        { name: 'predict', at: null },
        { name: 'plan', at: null },
        { name: 'act', at: null },
        { name: 'learn', at: null },
        { name: 'archive', at: null },
      ],
      decision: null,
      completedAt: null,
    };
    this._lifecycleTraces.push(trace);
    if (this._lifecycleTraces.length > 200) this._lifecycleTraces.shift();
    return trace;
  }

  _lifecycleEnd(trace, result) {
    trace.completedAt = clock.now();
    trace.stages.find(s => s.name === 'understand').at = clock.now();
    trace.stages.find(s => s.name === 'act').at = clock.now();
    trace.stages.find(s => s.name === 'archive').at = clock.now();
    trace.decision = result?.action || result?.summary || 'processed';
    trace.duration = clock.now() - trace.startedAt;
  }

  getLifecycle(limit = 20) {
    return this._lifecycleTraces.slice(-limit);
  }

  getStats() {
    const byType = {};
    for (const trace of this._lifecycleTraces) {
      byType[trace.eventType] = (byType[trace.eventType] || 0) + 1;
    }
    return {
      totalTraces: this._lifecycleTraces.length,
      handlerCount: Array.from(this._handlers.values()).reduce((s, h) => s + h.length, 0),
      byType,
    };
  }
}

export const pipeline = new CognitivePipeline();
export default pipeline;
