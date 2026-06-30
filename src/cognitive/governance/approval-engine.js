import { createLogger } from '../../core/logger.js';
import { bus } from '../event-bus.js';

const log = createLogger('APPROVAL');

export const APPROVAL_STATUS = {
  PENDING:   'pending',
  APPROVED:  'approved',
  REJECTED:  'rejected',
  EXPIRED:   'expired',
};

export class ApprovalEngine {
  #requests = new Map();
  #history = [];
  #pending = new Map();

  async request(action, context = {}) {
    const id = `apr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const request = {
      id,
      action: { ...action },
      context,
      status: APPROVAL_STATUS.PENDING,
      created: Date.now(),
      expiresAt: Date.now() + (context.timeout || 300000),
      decidedBy: null,
      decidedAt: null,
      reason: null,
    };

    this.#requests.set(id, request);
    this.#pending.set(id, request);
    this.#history.push(request);

    bus.emit('approval:requested', {
      id, action: action.type || action, agent: context.agent, summary: request.summary,
    });

    if (context.autoApprove) {
      this.approve(id, 'system', 'auto_approve');
      return this.#requests.get(id);
    }

    log.info(`[APPROVAL] request #${id}: ${action.type || action} by ${context.agent}`);
    return request;
  }

  approve(id, approver, reason = '') {
    const req = this.#requests.get(id);
    if (!req || req.status !== APPROVAL_STATUS.PENDING) return false;
    req.status = APPROVAL_STATUS.APPROVED;
    req.decidedBy = approver;
    req.decidedAt = Date.now();
    req.reason = reason;
    this.#pending.delete(id);
    bus.emit('approval:approved', { id, approver, reason });
    log.info(`[APPROVAL] #${id} approved by ${approver}`);
    return true;
  }

  reject(id, approver, reason = '') {
    const req = this.#requests.get(id);
    if (!req || req.status !== APPROVAL_STATUS.PENDING) return false;
    req.status = APPROVAL_STATUS.REJECTED;
    req.decidedBy = approver;
    req.decidedAt = Date.now();
    req.reason = reason;
    this.#pending.delete(id);
    bus.emit('approval:rejected', { id, approver, reason });
    log.info(`[APPROVAL] #${id} rejected by ${approver}`);
    return true;
  }

  get(id) {
    return this.#requests.get(id);
  }

  listPending() {
    return Array.from(this.#pending.values());
  }

  listRecent(limit = 20) {
    return this.#history.slice(-limit);
  }

  cleanup() {
    const now = Date.now();
    for (const [id, req] of this.#pending) {
      if (now > req.expiresAt) {
        req.status = APPROVAL_STATUS.EXPIRED;
        this.#pending.delete(id);
        bus.emit('approval:expired', { id });
      }
    }
  }

  getStats() {
    return {
      pending: this.#pending.size,
      total: this.#history.length,
      approved: this.#history.filter(r => r.status === APPROVAL_STATUS.APPROVED).length,
      rejected: this.#history.filter(r => r.status === APPROVAL_STATUS.REJECTED).length,
      expired: this.#history.filter(r => r.status === APPROVAL_STATUS.EXPIRED).length,
    };
  }
}

export const approval = new ApprovalEngine();
export default approval;
