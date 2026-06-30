import { createLogger } from '../../core/logger.js';
import { bus } from '../event-bus.js';

const log = createLogger('AUDIT');

export const AUDIT_ACTIONS = {
  CREATE: 'create',
  READ:   'read',
  UPDATE: 'update',
  DELETE: 'delete',
  EXECUTE: 'execute',
  DECIDE: 'decide',
  APPROVE: 'approve',
  DENY:   'deny',
  LOGIN:  'login',
  ERROR:  'error',
};

export class AuditEngine {
  #entries = [];
  #maxEntries = 1000;

  log({ agent, action, resource, resourceId, details = {}, result = 'success', reason = '' }) {
    const entry = {
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      agent,
      action,
      resource,
      resourceId: resourceId || null,
      details: typeof details === 'string' ? { message: details } : details,
      result,
      reason,
    };
    this.#entries.push(entry);
    if (this.#entries.length > this.#maxEntries) this.#entries.shift();
    bus.emit('audit:entry', entry);
    return entry;
  }

  query({ agent, action, resource, result, limit = 50, since } = {}) {
    let results = this.#entries;
    if (agent) results = results.filter(e => e.agent === agent);
    if (action) results = results.filter(e => e.action === action);
    if (resource) results = results.filter(e => e.resource === resource);
    if (result) results = results.filter(e => e.result === result);
    if (since) results = results.filter(e => e.timestamp >= since);
    return results.slice(-limit);
  }

  getByAgent(agentName, limit = 50) {
    return this.query({ agent: agentName, limit });
  }

  getByResource(resource, resourceId, limit = 50) {
    return this.#entries.filter(e => e.resource === resource && e.resourceId === resourceId).slice(-limit);
  }

  getRecent(limit = 50) {
    return this.#entries.slice(-limit);
  }

  summary(since = Date.now() - 86400000) {
    const recent = this.#entries.filter(e => e.timestamp >= since);
    const byAgent = {};
    const byAction = {};
    const byResult = {};
    for (const e of recent) {
      byAgent[e.agent] = (byAgent[e.agent] || 0) + 1;
      byAction[e.action] = (byAction[e.action] || 0) + 1;
      byResult[e.result] = (byResult[e.result] || 0) + 1;
    }
    return {
      period: '24h',
      total: recent.length,
      byAgent,
      byAction,
      byResult,
      errors: byResult['error'] || 0,
    };
  }

  clear() {
    this.#entries = [];
  }

  get size() { return this.#entries.length; }
}

export const audit = new AuditEngine();
export default audit;
