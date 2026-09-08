import { createLogger } from '../../infrastructure/logger.js';

const log = createLogger('EVENT-BUS-V2');

class EventSubscription {
  constructor(event, handler, opts = {}) {
    this.id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.event = event;
    this.handler = handler;
    this.priority = opts.priority || 0;
    this.once = opts.once || false;
    this.filter = opts.filter || null;
    this.fired = 0;
  }

  matches(data) {
    if (!this.filter) return true;
    return Object.entries(this.filter).every(([k, v]) => data[k] === v);
  }
}

export class EventBusV2 {
  constructor() {
    this.subscriptions = new Map();
    this.history = [];
    this.maxHistory = 100;
    this.initialized = false;
  }

  init() {
    this.initialized = true;
    log.info('Event Bus V2 pret');
  }

  on(event, handler, opts = {}) {
    if (!this.subscriptions.has(event)) this.subscriptions.set(event, []);
    const sub = new EventSubscription(event, handler, opts);
    this.subscriptions.get(event).push(sub);
    this.subscriptions.get(event).sort((a, b) => b.priority - a.priority);
    return sub.id;
  }

  once(event, handler, opts = {}) {
    return this.on(event, handler, { ...opts, once: true });
  }

  off(subId) {
    for (const [, subs] of this.subscriptions) {
      const idx = subs.findIndex(s => s.id === subId);
      if (idx !== -1) { subs.splice(idx, 1); return true; }
    }
    return false;
  }

  async emit(event, data = {}) {
    const subs = this.subscriptions.get(event) || [];
    const wildcardSubs = this.subscriptions.get('*') || [];
    const allSubs = [...subs, ...wildcardSubs];

    if (allSubs.length === 0) return;

    this.history.push({ event, data: this._sanitize(data), timestamp: Date.now() });
    if (this.history.length > this.maxHistory) this.history.shift();

    const toRemove = [];
    for (const sub of allSubs) {
      if (!sub.matches(data)) continue;
      try {
        sub.fired++;
        await Promise.resolve(sub.handler(data, event));
        if (sub.once) toRemove.push(sub.id);
      } catch (err) {
        log.warn(`EventBus handler for ${event}: ${err.message}`);
      }
    }
    for (const id of toRemove) this.off(id);
  }

  emitSync(event, data = {}) {
    this.emit(event, data).catch(() => {});
  }

  onMessage(handler) {
    return this.on('message', handler);
  }

  onToolCall(handler) {
    return this.on('tool:execute', handler);
  }

  onAgentAction(handler) {
    return this.on('agent:action', handler);
  }

  onError(handler) {
    return this.on('error', handler);
  }

  onCoreReady(handler) {
    return this.once('core:ready', handler);
  }

  getHistory(event = null, limit = 20) {
    const items = event ? this.history.filter(h => h.event === event) : this.history;
    return items.slice(-limit);
  }

  getStats() {
    const eventCounts = {};
    for (const h of this.history) {
      eventCounts[h.event] = (eventCounts[h.event] || 0) + 1;
    }
    const subCounts = {};
    for (const [event, subs] of this.subscriptions) {
      subCounts[event] = subs.length;
    }
    return { totalEvents: this.history.length, subscriptions: this.subscriptions.size, subscriberCount: subCounts, eventsByType: eventCounts };
  }

  _sanitize(data) {
    if (typeof data !== 'object' || !data) return data;
    const sanitized = { ...data };
    if (sanitized.text) sanitized.text = sanitized.text.slice(0, 200);
    if (sanitized.content) sanitized.content = sanitized.content.slice(0, 200);
    if (sanitized.message) sanitized.message = sanitized.message.slice(0, 200);
    if (sanitized.error) sanitized.error = sanitized.error.slice(0, 200);
    return sanitized;
  }
}

export const eventBusV2 = new EventBusV2();
export default eventBusV2;
