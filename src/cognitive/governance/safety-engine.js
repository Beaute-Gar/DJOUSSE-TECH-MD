import { createLogger } from '../../core/logger.js';
import { policy, POLICY_EFFECTS } from './policy-engine.js';
import { permissions } from './permission-engine.js';
import { approval } from './approval-engine.js';
import { audit, AUDIT_ACTIONS } from './audit-engine.js';
import { trust } from './trust-engine.js';
import { bus } from '../event-bus.js';

const log = createLogger('SAFETY');

export const SAFETY_STATUS = {
  ALLOW:      'allow',
  DENY:       'deny',
  WARN:       'warn',
  PENDING:    'pending_approval',
  RESTRICTED: 'restricted',
};

export class SafetyEngine {
  async check(agentName, action, context = {}) {
    const checks = await Promise.all([
      this.#checkTrust(agentName),
      this.#checkPermission(agentName, action, context),
      this.#checkPolicy(action, context),
    ]);

    const [trustResult, permResult, policyResult] = checks;
    const violations = [];

    if (!trustResult.allowed) violations.push({ engine: 'trust', reason: trustResult.reason });
    if (!permResult.allowed) violations.push({ engine: 'permission', reason: permResult.reason });

    audit.log({
      agent: agentName, action: action.type || 'unknown', resource: action.resource || context.resource,
      details: { checks: { trust: trustResult, permission: permResult, policy: policyResult } },
      result: violations.length > 0 || policyResult.effect === POLICY_EFFECTS.DENY ? 'denied' : 'allowed',
    });

    if (violations.length > 0) {
      log.warn(`[SAFETY] ${agentName} blocked: ${violations.map(v => v.reason).join(', ')}`);
      return { status: SAFETY_STATUS.DENY, violations, allowed: false };
    }

    if (policyResult.effect === POLICY_EFFECTS.DENY) {
      return { status: SAFETY_STATUS.DENY, violations: [{ engine: 'policy', reason: `${policyResult.policy?.name} blocked` }], allowed: false };
    }

    if (policyResult.effect === POLICY_EFFECTS.APPROVE) {
      const req = await approval.request(action, { agent: agentName, ...context });
      audit.log({
        agent: agentName, action: AUDIT_ACTIONS.APPROVE, resource: action.resource || 'action',
        details: { requiresApproval: true, requestId: req.id }, result: 'pending',
      });
      return { status: SAFETY_STATUS.PENDING, approvalRequest: req, allowed: false, pending: true };
    }

    if (policyResult.effect === POLICY_EFFECTS.WARN) {
      return { status: SAFETY_STATUS.WARN, warning: policyResult.policy?.description || 'Warning', allowed: true };
    }

    trust.record(agentName, 'success', { action, context });
    return { status: SAFETY_STATUS.ALLOW, allowed: true };
  }

  async #checkTrust(agentName) {
    if (!trust.canAct(agentName)) {
      return { allowed: false, reason: `Trust score too low for ${agentName}` };
    }
    return { allowed: true };
  }

  async #checkPermission(agentName, action, context) {
    const resource = action.resource || context.resource || action.type || 'unknown';
    const perms = ['write', 'read', 'delete', 'admin', 'execute', 'send', 'modify', 'approve', 'configure'];
    const requiredPerm = action.permission || context.permission || (action.type && perms.includes(action.type) ? action.type : 'read');
    if (!permissions.can(agentName, resource, requiredPerm, context)) {
      return { allowed: false, reason: `${agentName} lacks ${requiredPerm} on ${resource}` };
    }
    return { allowed: true };
  }

  async #checkPolicy(action, context) {
    return policy.evaluate(action, context);
  }

  async safeExecute(agentName, action, context = {}, executeFn) {
    const check = await this.check(agentName, action, context);
    if (!check.allowed) {
      if (check.status === SAFETY_STATUS.PENDING) {
        return { status: 'pending_approval', approvalRequest: check.approvalRequest, message: 'Waiting for approval' };
      }
      return { status: 'denied', violations: check.violations, message: 'Action blocked by governance' };
    }
    try {
      const result = await executeFn();
      trust.record(agentName, 'success', { action, context });
      audit.log({
        agent: agentName, action: action.type || 'execute', resource: action.resource || 'unknown',
        details: { result }, result: 'success',
      });
      return { status: 'success', result };
    } catch (err) {
      trust.record(agentName, 'error', { action, context, error: err.message });
      audit.log({
        agent: agentName, action: action.type || 'execute', resource: action.resource || 'unknown',
        details: { error: err.message }, result: 'error',
      });
      return { status: 'error', error: err.message };
    }
  }

  getAgentStatus(agentName) {
    const t = trust.getScore(agentName);
    return {
      agent: agentName,
      trusted: t ? t.score >= 0.7 : true,
      autonomy: t ? t.autonomy : 1.0,
      canAct: t ? t.score >= 0.4 : true,
      score: t?.score || null,
      permissions: permissions.getPermissions(agentName)?.list() || [],
    };
  }
}

export const safety = new SafetyEngine();
export default safety;
