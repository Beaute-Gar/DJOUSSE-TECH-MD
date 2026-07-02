import { createLogger } from '../../core/logger.js';

const log = createLogger('PERM');

export const PERMISSIONS = {
  READ:       'read',
  WRITE:      'write',
  DELETE:     'delete',
  EXECUTE:    'execute',
  ADMIN:      'admin',
  SEND:       'send',
  MODIFY:     'modify',
  APPROVE:    'approve',
  CONFIGURE:  'configure',
};

export const RESOURCE_TYPES = {
  MISSION:    'mission',
  CRM:        'crm',
  MESSAGE:    'message',
  CONCEPT:    'concept',
  KNOWLEDGE:  'knowledge',
  SETTINGS:   'settings',
  AGENT:      'agent',
  MEMORY:     'memory',
  FINANCE:    'finance',
  AUDIT:      'audit',
};

export class PermissionSet {
  constructor(grants = []) {
    this.grants = new Map();
    for (const g of grants) this.grant(g.resource, g.permission, g.conditions);
  }

  grant(resource, permission, conditions = null) {
    const key = `${resource}:${permission}`;
    this.grants.set(key, { resource, permission, conditions });
    return this;
  }

  revoke(resource, permission) {
    this.grants.delete(`${resource}:${permission}`);
  }

  check(resource, permission, context = {}) {
    const exact = this.grants.get(`${resource}:${permission}`);
    if (exact) return this._checkConditions(exact.conditions, context);
    const wildcard = this.grants.get(`${resource}:*`);
    if (wildcard) return this._checkConditions(wildcard.conditions, context);
    const superWildcard = this.grants.get(`*:*`);
    if (superWildcard) return this._checkConditions(superWildcard.conditions, context);
    return false;
  }

  _checkConditions(conditions, context) {
    if (!conditions) return true;
    return Object.entries(conditions).every(([key, val]) => context[key] === val);
  }

  list() {
    return Array.from(this.grants.entries()).map(([key, g]) => ({
      resource: g.resource, permission: g.permission, hasConditions: !!g.conditions,
    }));
  }
}

export class PermissionEngine {
  #agents = new Map();
  #roles = new Map();
  #defaultPermissions = new PermissionSet();

  constructor() {
    this.#defaultPermissions.grant('message', 'read');
    this.#defaultPermissions.grant('memory', 'read');
    this.#defaultPermissions.grant('concept', 'read');
    this.#defaultPermissions.grant('knowledge', 'read');
    this.#defaultPermissions.grant('SEND_MESSAGE', 'read');
    this.#defaultPermissions.grant('SEND_MESSAGE', 'send');
    this.#defaultPermissions.grant('SEND_IMAGE', 'read');
    this.#defaultPermissions.grant('SEND_IMAGE', 'send');
    this.#defaultPermissions.grant('SEND_AUDIO', 'read');
    this.#defaultPermissions.grant('SEND_AUDIO', 'send');
    this.#defaultPermissions.grant('SEND_VIDEO', 'read');
    this.#defaultPermissions.grant('SEND_VIDEO', 'send');
    this.#defaultPermissions.grant('SEND_DOCUMENT', 'read');
    this.#defaultPermissions.grant('SEND_DOCUMENT', 'send');
    this.#defaultPermissions.grant('REACT', 'read');
    this.#defaultPermissions.grant('REACT', 'write');
    this.#defaultPermissions.grant('DELETE_MESSAGE', 'read');
    this.#defaultPermissions.grant('DELETE_MESSAGE', 'delete');
    this.#defaultPermissions.grant('CALL_API', 'read');
    this.#defaultPermissions.grant('CALL_API', 'execute');
  }

  registerAgent(agentName, permissions = []) {
    const set = new PermissionSet(permissions);
    this.#agents.set(agentName, set);
    log.info(`[PERM] registered ${agentName} with ${permissions.length} grants`);
    return set;
  }

  getPermissions(agentName) {
    return this.#agents.get(agentName);
  }

  grant(agentName, resource, permission, conditions = null) {
    const set = this.#agents.get(agentName);
    if (!set) return false;
    set.grant(resource, permission, conditions);
    return true;
  }

  revoke(agentName, resource, permission) {
    const set = this.#agents.get(agentName);
    if (!set) return false;
    set.revoke(resource, permission);
    return true;
  }

  can(agentName, resource, permission, context = {}) {
    const set = this.#agents.get(agentName);
    if (set && set.check(resource, permission, context)) return true;
    return this.#defaultPermissions.check(resource, permission, context);
  }

  require(agentName, resource, permission, context = {}) {
    const allowed = this.can(agentName, resource, permission, context);
    if (!allowed) {
      log.warn(`[PERM] DENIED: ${agentName} needs ${permission} on ${resource}`);
    }
    return allowed;
  }

  defineRole(name, permissions) {
    this.#roles.set(name, new PermissionSet(permissions));
  }

  assignRole(agentName, roleName) {
    const role = this.#roles.get(roleName);
    if (!role) return false;
    const set = this.#agents.get(agentName);
    if (!set) return false;
    for (const g of role.list()) {
      set.grant(g.resource, g.permission);
    }
    return true;
  }

  list() {
    return Array.from(this.#agents.entries()).map(([name, set]) => ({
      agent: name,
      permissions: set.list(),
    }));
  }

  addDefaultPermissions() {
    this.registerAgent('executive', [
      { resource: '*', permission: 'read' },
      { resource: '*', permission: 'write' },
      { resource: 'mission', permission: 'delete' },
      { resource: 'message', permission: 'send', conditions: { requiresApproval: false } },
      { resource: 'audit', permission: 'read' },
    ]);
    this.registerAgent('research', [
      { resource: '*', permission: 'read' },
      { resource: 'memory', permission: 'read' },
      { resource: 'knowledge', permission: 'read' },
      { resource: 'concept', permission: 'read' },
    ]);
    this.registerAgent('communication', [
      { resource: 'message', permission: 'read' },
      { resource: 'message', permission: 'send', conditions: { requiresApproval: true } },
      { resource: 'crm', permission: 'read' },
    ]);
    this.registerAgent('learning', [
      { resource: '*', permission: 'read' },
      { resource: 'memory', permission: 'write' },
      { resource: 'settings', permission: 'write' },
    ]);
    this.registerAgent('finance', [
      { resource: 'finance', permission: 'read' },
      { resource: 'finance', permission: 'write', conditions: { requiresApproval: true } },
    ]);
  }
}

export const permissions = new PermissionEngine();
export default permissions;
