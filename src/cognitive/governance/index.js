import { policy as _policy, PolicyEngine, Policy, POLICY_EFFECTS } from './policy-engine.js';
import { permissions as _perms, PermissionEngine, PermissionSet, PERMISSIONS, RESOURCE_TYPES } from './permission-engine.js';
import { approval as _approval, ApprovalEngine, APPROVAL_STATUS } from './approval-engine.js';
import { audit as _audit, AuditEngine, AUDIT_ACTIONS } from './audit-engine.js';
import { trust as _trust, TrustEngine } from './trust-engine.js';
import { safety as _safety, SafetyEngine, SAFETY_STATUS } from './safety-engine.js';

export { PolicyEngine, Policy, POLICY_EFFECTS };
export { PermissionEngine, PermissionSet, PERMISSIONS, RESOURCE_TYPES };
export { ApprovalEngine, APPROVAL_STATUS };
export { AuditEngine, AUDIT_ACTIONS };
export { TrustEngine };
export { SafetyEngine, SAFETY_STATUS };

export const policy = _policy;
export const permissions = _perms;
export const approval = _approval;
export const audit = _audit;
export const trust = _trust;
export const safety = _safety;

export async function initGovernance() {
  policy.addDefaultPolicies();
  permissions.addDefaultPermissions();
  trust.register('executive');
  trust.register('research');
  trust.register('communication');
  trust.register('learning');
  const { bus } = await import('../event-bus.js');
  bus.emit('governance:ready', { timestamp: Date.now() });
  return { policy, permissions, trust };
}

export default { policy, permissions, approval, audit, trust, safety, initGovernance };
