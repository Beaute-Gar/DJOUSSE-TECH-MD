import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';
import { clock } from './cognitive-clock.js';
import { trust } from './governance/trust-engine.js';
import { policy, POLICY_EFFECTS } from './governance/policy-engine.js';
import { safety } from './governance/safety-engine.js';
import { approval } from './governance/approval-engine.js';
import { audit } from './governance/audit-engine.js';

const log = createLogger('EXECUTOR');

export const ACTION_TYPES = {
  SEND_MESSAGE:     'SEND_MESSAGE',
  SEND_IMAGE:       'SEND_IMAGE',
  SEND_AUDIO:       'SEND_AUDIO',
  SEND_VIDEO:       'SEND_VIDEO',
  SEND_DOCUMENT:    'SEND_DOCUMENT',
  REACT:            'REACT',
  DELETE_MESSAGE:   'DELETE_MESSAGE',
  REMOVE_MEMBER:    'REMOVE_MEMBER',
  PROMOTE_ADMIN:    'PROMOTE_ADMIN',
  DEMOTE_ADMIN:     'DEMOTE_ADMIN',
  GROUP_UPDATE:     'GROUP_UPDATE',
  GROUP_INVITE:     'GROUP_INVITE',
  GROUP_LEAVE:      'GROUP_LEAVE',
  MUTE_MEMBER:      'MUTE_MEMBER',
  PIN_MESSAGE:      'PIN_MESSAGE',
  CALL_API:         'CALL_API',
};

const PRIORITY_ORDER = ['critical', 'high', 'normal', 'low', 'background'];
const MAX_RETRIES = 3;
const MAX_CONCURRENT = 3;

export class ActionExecutor {
  constructor() {
    this._queues = { critical: [], high: [], normal: [], low: [], background: [] };
    this._active = 0;
    this._maxConcurrent = MAX_CONCURRENT;
    this._running = false;
    this._history = [];
    this._maxHistory = 1000;
    this._sockProvider = null;
    this._stats = { executed: 0, queued: 0, failed: 0, blocked: 0, pendingApproval: 0 };
    this._rateLimitMap = new Map();
  }

  setSockProvider(provider) {
    this._sockProvider = provider;
  }

  async execute(action, context = {}) {
    const entry = this._createEntry(action, context);

    const check = await this._governance(entry);
    if (!check.allowed) {
      this._stats.blocked++;
      bus.emit('action:blocked', { entry, reason: check.reason });
      return { status: 'blocked', reason: check.reason, entry };
    }
    if (check.pendingApproval) {
      this._stats.pendingApproval++;
      return { status: 'pending_approval', approvalRequest: check.approvalRequest, entry };
    }

    if (this._isRateLimited(entry)) {
      this._stats.queued++;
      this._enqueue(entry, 'low');
      return { status: 'rate_limited', entryId: entry.id, message: 'Rate limit — requeued at low priority' };
    }

    if (entry.priority === 'critical') {
      this._run(entry);
      return { status: 'executing', entryId: entry.id };
    }

    this._stats.queued++;
    this._enqueue(entry, entry.priority);
    setImmediate(() => this._processQueue());
    return { status: 'queued', entryId: entry.id };
  }

  _createEntry(action, context) {
    return {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: action.type,
      payload: action.payload || {},
      source: action.source || context.source || 'unknown',
      priority: action.priority || 'normal',
      context: { ...context },
      createdAt: clock.now(),
      startedAt: null,
      completedAt: null,
      retries: 0,
      maxRetries: action.maxRetries ?? MAX_RETRIES,
      status: 'created',
      result: null,
      error: null,
    };
  }

  async _governance(entry) {
    const actionForGov = { type: entry.type, payload: entry.payload, source: entry.source };

    const trustOk = trust.canAct(entry.source);
    if (!trustOk) {
      audit.log({ agent: entry.source, action: entry.type, resource: entry.payload.jid || 'unknown', details: entry.payload, result: 'denied_trust' });
      return { allowed: false, reason: `Trust insufficient for ${entry.source}` };
    }

    const policyResult = policy.evaluate(actionForGov, entry.context);
    if (policyResult.effect === POLICY_EFFECTS.DENY) {
      audit.log({ agent: entry.source, action: entry.type, resource: entry.payload.jid || 'unknown', details: { policy: policyResult.policy?.name }, result: 'denied_policy' });
      return { allowed: false, reason: `Policy blocked: ${policyResult.policy?.name || 'unknown'}` };
    }

    if (policyResult.effect === POLICY_EFFECTS.APPROVE) {
      const req = await approval.request(actionForGov, { agent: entry.source, ...entry.context });
      audit.log({ agent: entry.source, action: entry.type, resource: entry.payload.jid || 'unknown', details: { requiresApproval: true, requestId: req.id }, result: 'pending_approval' });
      return { allowed: false, pendingApproval: true, approvalRequest: req };
    }

    const safetyResult = await safety.check(entry.source, actionForGov, { resource: entry.type });
    if (!safetyResult.allowed) {
      audit.log({ agent: entry.source, action: entry.type, resource: entry.payload.jid || 'unknown', details: { safety: safetyResult.status }, result: 'denied_safety' });
      return { allowed: false, reason: `Safety blocked: ${safetyResult.status}` };
    }

    trust.record(entry.source, 'success', { type: entry.type });
    audit.log({ agent: entry.source, action: entry.type, resource: entry.payload.jid || 'unknown', details: entry.payload, result: 'approved' });
    return { allowed: true };
  }

  _isRateLimited(entry) {
    const key = `${entry.source}:${entry.type}`;
    const now = clock.now();
    const windowMs = 5000;
    const maxPerWindow = 10;

    if (!this._rateLimitMap.has(key)) this._rateLimitMap.set(key, []);
    const timestamps = this._rateLimitMap.get(key).filter(t => now - t < windowMs);
    timestamps.push(now);
    this._rateLimitMap.set(key, timestamps);
    return timestamps.length > maxPerWindow;
  }

  _enqueue(entry, priority) {
    this._queues[priority]?.push(entry) || this._queues.normal.push(entry);
  }

  async _processQueue() {
    if (this._running) return;
    this._running = true;

    while (this._active < this._maxConcurrent) {
      let entry = null;
      for (const level of PRIORITY_ORDER) {
        if (this._queues[level].length > 0) {
          entry = this._queues[level].shift();
          break;
        }
      }
      if (!entry) break;
      this._run(entry);
    }
    this._running = false;
  }

  async _run(entry) {
    this._active++;
    entry.status = 'running';
    entry.startedAt = clock.now();
    bus.emit('action:started', { id: entry.id, type: entry.type });

    try {
      const result = await this._executeAction(entry);
      entry.status = 'completed';
      entry.completedAt = clock.now();
      entry.result = result;
      this._stats.executed++;
      this._record(entry);
      bus.emit('action:completed', { id: entry.id, type: entry.type, duration: entry.completedAt - entry.startedAt });
    } catch (err) {
      entry.error = err.message;
      if (entry.retries < entry.maxRetries) {
        entry.retries++;
        entry.status = 'retrying';
        log.warn(`[EXECUTOR] Retry ${entry.retries}/${entry.maxRetries} for ${entry.id} (${entry.type})`);
        this._enqueue(entry, 'low');
      } else {
        entry.status = 'failed';
        entry.completedAt = clock.now();
        this._stats.failed++;
        this._record(entry);
        log.error(`[EXECUTOR] Failed ${entry.id} (${entry.type}): ${err.message}`);
        bus.emit('action:failed', { id: entry.id, type: entry.type, error: err.message });
      }
    }
    this._active--;
    setImmediate(() => this._processQueue());
  }

  async _executeAction(entry) {
    const sock = typeof this._sockProvider === 'function' ? this._sockProvider() : this._sockProvider;
    if (!sock) throw new Error('WhatsApp socket not available');
    if (!sock.sendMessage) throw new Error('Socket has no sendMessage');

    const { type, payload } = entry;

    switch (type) {
      case ACTION_TYPES.SEND_MESSAGE:
        return sock.sendMessage(payload.jid, { text: payload.text, ...(payload.options || {}) });

      case ACTION_TYPES.SEND_IMAGE:
        return sock.sendMessage(payload.jid, {
          image: payload.buffer || payload.url,
          caption: payload.caption || '',
          ...(payload.options || {}),
        });

      case ACTION_TYPES.SEND_AUDIO:
        return sock.sendMessage(payload.jid, {
          audio: payload.buffer || payload.url,
          mimetype: payload.mimetype || 'audio/mp4',
          ptt: payload.ptt || false,
          ...(payload.options || {}),
        });

      case ACTION_TYPES.REACT:
        return sock.sendMessage(payload.jid, {
          react: { text: payload.emoji, key: payload.messageKey },
        });

      case ACTION_TYPES.DELETE_MESSAGE:
        return sock.sendMessage(payload.jid, {
          delete: payload.messageKey,
        });

      case ACTION_TYPES.REMOVE_MEMBER:
        return sock.groupParticipantsUpdate(payload.groupJid, [payload.participantJid], 'remove');

      case ACTION_TYPES.PROMOTE_ADMIN:
        return sock.groupParticipantsUpdate(payload.groupJid, [payload.participantJid], 'promote');

      case ACTION_TYPES.DEMOTE_ADMIN:
        return sock.groupParticipantsUpdate(payload.groupJid, [payload.participantJid], 'demote');

      case ACTION_TYPES.GROUP_UPDATE:
        return sock.groupUpdateSubject(payload.groupJid, payload.subject);

      case ACTION_TYPES.GROUP_INVITE:
        return sock.groupInviteCode(payload.groupJid);

      case ACTION_TYPES.GROUP_LEAVE:
        return sock.groupLeave(payload.groupJid);

      case ACTION_TYPES.CALL_API:
        return this._callExternalApi(payload);

      default:
        throw new Error(`Unknown action type: ${type}`);
    }
  }

  async _callExternalApi(payload) {
    const { url, method = 'GET', headers = {}, body } = payload;
    const fetch = globalThis.fetch || (await import('node-fetch')).default;
    const opts = { method, headers };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);
    const response = await fetch(url, opts);
    return { status: response.status, body: await response.text().catch(() => null) };
  }

  _record(entry) {
    this._history.push({
      id: entry.id, type: entry.type, source: entry.source,
      priority: entry.priority, status: entry.status,
      createdAt: entry.createdAt, duration: entry.completedAt ? entry.completedAt - entry.startedAt : null,
      error: entry.error,
    });
    if (this._history.length > this._maxHistory) this._history.shift();
  }

  getHistory(limit = 50, filters = {}) {
    let entries = [...this._history];
    if (filters.type) entries = entries.filter(e => e.type === filters.type);
    if (filters.status) entries = entries.filter(e => e.status === filters.status);
    if (filters.source) entries = entries.filter(e => e.source === filters.source);
    return entries.slice(-limit).reverse();
  }

  getStats() {
    const queueLengths = {};
    for (const level of PRIORITY_ORDER) queueLengths[level] = this._queues[level].length;
    return { ...this._stats, queues: queueLengths, active: this._active };
  }

  getQueueStatus() {
    const summary = {};
    for (const level of PRIORITY_ORDER) {
      const q = this._queues[level];
      summary[level] = { length: q.length, types: [...new Set(q.map(e => e.type))] };
    }
    return summary;
  }

  cancelQueued(filterFn) {
    let count = 0;
    for (const level of PRIORITY_ORDER) {
      const before = this._queues[level].length;
      this._queues[level] = this._queues[level].filter(e => { const keep = !filterFn(e); if (!keep) count++; return keep; });
    }
    return count;
  }
}

export const executor = new ActionExecutor();
export default executor;
