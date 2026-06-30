import { createLogger } from '../../core/logger.js';

const log = createLogger('POLICY');

export const POLICY_EFFECTS = {
  ALLOW:   'allow',
  DENY:    'deny',
  WARN:    'warn',
  APPROVE: 'require_approval',
  LOG:     'log_only',
};

export class Policy {
  constructor({ id, name, condition, effect, priority = 0, enabled = true, description = '' }) {
    this.id = id || `pol_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.name = name;
    this.condition = condition;
    this.effect = effect;
    this.priority = priority;
    this.enabled = enabled;
    this.description = description;
    this.created = Date.now();
    this.matchCount = 0;
  }

  matches(action, context) {
    if (!this.enabled) return false;
    let matched = false;
    if (typeof this.condition === 'function') {
      matched = this.condition(action, context);
    } else if (typeof this.condition === 'object') {
      matched = Object.entries(this.condition).every(([key, val]) => {
        const value = this._get(action, key) || this._get(context, key);
        if (typeof val === 'function') return val(value);
        return value === val || (Array.isArray(val) && val.includes(value));
      });
    }
    if (matched) this.matchCount++;
    return matched;
  }

  _get(obj, path) {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }
}

export class PolicyEngine {
  #policies = new Map();
  #history = [];

  add(policy) {
    const p = policy instanceof Policy ? policy : new Policy(policy);
    this.#policies.set(p.id, p);
    return p;
  }

  remove(id) {
    this.#policies.delete(id);
  }

  get(id) {
    return this.#policies.get(id);
  }

  enable(id) {
    const p = this.#policies.get(id);
    if (p) p.enabled = true;
  }

  disable(id) {
    const p = this.#policies.get(id);
    if (p) p.enabled = false;
  }

  evaluate(action, context = {}) {
    const matched = Array.from(this.#policies.values())
      .filter(p => p.matches(action, context))
      .sort((a, b) => b.priority - a.priority);

    if (matched.length === 0) return { effect: POLICY_EFFECTS.ALLOW, matched: [] };

    const highest = matched[0];
    const entry = { action, context, timestamp: Date.now(), matched: matched.map(m => m.id), effect: highest.effect };
    this.#history.push(entry);
    if (this.#history.length > 500) this.#history.shift();

    if (highest.effect === POLICY_EFFECTS.DENY) {
      log.warn(`[POLICY] DENY: ${action.type || action} matched ${highest.name}`);
    }

    return { effect: highest.effect, policy: highest, matched };
  }

  list() {
    return Array.from(this.#policies.values()).map(p => ({
      id: p.id, name: p.name, effect: p.effect, priority: p.priority, enabled: p.enabled, matchCount: p.matchCount,
    }));
  }

  getHistory(limit = 20) {
    return this.#history.slice(-limit);
  }

  addDefaultPolicies() {
    this.add(new Policy({
      name: 'interdire_suppression_masse',
      condition: (a) => a.type === 'delete' && a.count > 10,
      effect: POLICY_EFFECTS.DENY,
      priority: 100,
      description: 'Interdit les suppressions de plus de 10 elements',
    }));
    this.add(new Policy({
      name: 'approbation_envoi_masse',
      condition: (a) => a.type === 'send_message' && a.targets && a.targets.length > 5,
      effect: POLICY_EFFECTS.APPROVE,
      priority: 90,
      description: 'Requiert approbation pour envoi a plus de 5 destinataires',
    }));
    this.add(new Policy({
      name: 'interdire_modification_crm_critique',
      condition: (a) => a.type === 'update_crm' && a.field === 'status' && ['archived', 'deleted'].includes(a.value),
      effect: POLICY_EFFECTS.APPROVE,
      priority: 80,
      description: 'Requiert approbation pour archiver/supprimer un contact CRM',
    }));
    this.add(new Policy({
      name: 'avertissement_action_financiere',
      condition: (a) => a.type === 'financial_transaction' && a.amount > 1000,
      effect: POLICY_EFFECTS.WARN,
      priority: 70,
      description: 'Avertit pour les transactions financieres > 1000',
    }));
    this.add(new Policy({
      name: 'toujours_auditer_executive',
      condition: (a) => a.agent === 'executive' || (a.type === 'delegate' || a.type === 'arbitrate'),
      effect: POLICY_EFFECTS.LOG,
      priority: 10,
      description: 'Audite toutes les decisions de l Executive Agent',
    }));
    this.add(new Policy({
      name: 'interdire_auto_modification_permissions',
      condition: (a) => a.type === 'modify_permissions' && a.target === a.agent,
      effect: POLICY_EFFECTS.DENY,
      priority: 100,
      description: 'Interdit a un agent de modifier ses propres permissions',
    }));
    this.add(new Policy({
      name: 'approbation_suppression_mission',
      condition: (a) => a.type === 'delete_mission' || (a.type === 'update_mission' && a.updates?.status === 'cancelled'),
      effect: POLICY_EFFECTS.APPROVE,
      priority: 85,
      description: 'Requiert approbation pour supprimer ou annuler une mission',
    }));
  }
}

export const policy = new PolicyEngine();
export default policy;
