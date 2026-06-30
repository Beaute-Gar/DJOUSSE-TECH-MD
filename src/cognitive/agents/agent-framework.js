import { createLogger } from '../../core/logger.js';
import { bus, EVENTS } from '../event-bus.js';
import { api } from '../cognitive-api.js';

let _safety, _trust, _audit, _policy;
async function ensureGovernance() {
  if (!_safety) {
    const g = await import('../governance/index.js');
    _safety = g.safety;
    _trust = g.trust;
    _audit = g.audit;
    _policy = g.policy;
  }
}

const log = createLogger('AGENT');

export const AGENT_STATES = {
  CREATED:   'created',
  INIT:      'initializing',
  READY:     'ready',
  BUSY:      'busy',
  ERROR:     'error',
  STOPPED:   'stopped',
  DESTROYED: 'destroyed',
};

export class CognitiveAgent {
  constructor(name, capabilities = {}) {
    this.name = name;
    this.state = AGENT_STATES.CREATED;
    this.capabilities = {
      canObserve:    true,
      canReason:     true,
      canPlan:       false,
      canPredict:    false,
      canRemember:   true,
      canSearch:     true,
      canAct:        false,
      canCommunicate: false,
      requiresApproval: [],
      consumesAIBudget: 0,
      ...capabilities,
    };
    this.memory = { short: [], long: [] };
    this.executions = 0;
    this.errors = 0;
    this.lastActive = null;
    this.unsubscribe = [];
  }

  async init() {
    this.state = AGENT_STATES.INIT;
    log.info(`[${this.name}] initializing`);
    this.state = AGENT_STATES.READY;
    bus.emit('agent:ready', { agent: this.name });
    return this;
  }

  async start() {
    if (this.state === AGENT_STATES.DESTROYED) throw new Error(`${this.name} is destroyed`);
    if (this.state === AGENT_STATES.READY) return this;
    return this.init();
  }

  async stop() {
    this.state = AGENT_STATES.STOPPED;
    log.info(`[${this.name}] stopped`);
    bus.emit('agent:stopped', { agent: this.name });
  }

  async destroy() {
    for (const unsub of this.unsubscribe) {
      try { unsub(); } catch {}
    }
    this.unsubscribe = [];
    this.memory = { short: [], long: [] };
    this.state = AGENT_STATES.DESTROYED;
    log.info(`[${this.name}] destroyed`);
  }

  async think(input, context = {}) {
    this.state = AGENT_STATES.BUSY;
    this.lastActive = Date.now();
    this.executions++;
    try {
      const result = await this.process(input, context);
      this.state = AGENT_STATES.READY;
      await ensureGovernance();
      if (_trust) _trust.record(this.name, 'success', { input, context });
      return result;
    } catch (err) {
      this.errors++;
      this.state = AGENT_STATES.ERROR;
      log.error(`[${this.name}] think error: ${err.message}`);
      await ensureGovernance();
      if (_trust) _trust.record(this.name, 'error', { input, context, error: err.message });
      return { error: err.message, input };
    }
  }

  async process(input, context) {
    throw new Error(`${this.name} must implement process()`);
  }

  async observe(input, options = {}) {
    if (!this.capabilities.canObserve) return null;
    return api.observe(input, options);
  }

  async reason(context, options = {}) {
    if (!this.capabilities.canReason) return null;
    return api.reason(context, options);
  }

  async plan(goal, options = {}) {
    if (!this.capabilities.canPlan) return null;
    return api.plan(goal, options);
  }

  async predict(query, options = {}) {
    if (!this.capabilities.canPredict) return null;
    return api.predict(query, options);
  }

  async remember(query, options = {}) {
    if (!this.capabilities.canRemember) return null;
    return api.remember(query, options);
  }

  async search(query, options = {}) {
    if (!this.capabilities.canSearch) return null;
    return api.search(query, options);
  }

  async act(action, options = {}) {
    if (!this.capabilities.canAct) return null;
    await ensureGovernance();
    if (_safety) {
      const check = await _safety.check(this.name, action, { resource: action.type, ...options });
      if (!check.allowed) return { governance: check.status, violations: check.violations, message: 'Action blocked by governance' };
      if (_audit) _audit.log({ agent: this.name, action: action.type || 'act', resource: action.resource, details: action, result: 'allowed' });
    }
    return api.act(action, options);
  }

  async governedAct(action, options = {}) {
    await ensureGovernance();
    return _safety ? _safety.safeExecute(this.name, action, options, () => api.act(action, options)) : this.act(action, options);
  }

  needsApproval(action) {
    return this.capabilities.requiresApproval.some(a =>
      action.type === a || action.toLowerCase().includes(a.toLowerCase())
    );
  }

  on(event, fn) {
    const unsub = bus.on(event, fn);
    this.unsubscribe.push(unsub);
    return unsub;
  }

  emit(event, data = {}) {
    bus.emit(event, { agent: this.name, ...data });
  }

  async sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  rememberShort(key, value) {
    this.memory.short.push({ key, value, ts: Date.now() });
    if (this.memory.short.length > 100) this.memory.short.shift();
  }

  recallShort(key) {
    return this.memory.short.filter(m => m.key === key);
  }

  async getStatus() {
    await ensureGovernance();
    let trustScore = null, autonomy = 1.0;
    if (_trust) {
      const s = _trust.getScore(this.name);
      if (s) { trustScore = s.score; autonomy = s.autonomy; }
    }
    return {
      name: this.name,
      state: this.state,
      capabilities: this.capabilities,
      executions: this.executions,
      errors: this.errors,
      lastActive: this.lastActive,
      trustScore,
      autonomy,
    };
  }
}

export class AgentOrchestrator {
  #agents = new Map();
  #workflows = new Map();
  #history = [];

  register(agent) {
    this.#agents.set(agent.name, agent);
    log.info(`[ORCH] registered agent: ${agent.name}`);
    return this;
  }

  unregister(name) {
    this.#agents.delete(name);
    return this;
  }

  get(name) {
    return this.#agents.get(name);
  }

  async list() {
    const statuses = [];
    for (const a of this.#agents.values()) statuses.push(await a.getStatus());
    return statuses;
  }

  async startAll() {
    for (const agent of this.#agents.values()) {
      await agent.start().catch(err => log.error(`[ORCH] start ${agent.name}: ${err.message}`));
    }
    log.info(`[ORCH] all agents started`);
  }

  async stopAll() {
    for (const agent of this.#agents.values()) {
      await agent.stop().catch(() => {});
    }
  }

  async destroyAll() {
    for (const agent of this.#agents.values()) {
      await agent.destroy().catch(() => {});
    }
    this.#agents.clear();
  }

  async delegate(goal, options = {}) {
    const workflowId = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const workflow = {
      id: workflowId,
      goal,
      options,
      steps: [],
      status: 'running',
      created: Date.now(),
      completed: null,
      result: null,
    };
    this.#workflows.set(workflowId, workflow);
    this.#history.push(workflow);

    log.info(`[ORCH] delegate "${goal.slice(0, 60)}"`);

    const exec = this.#agents.get('executive');
    if (exec) {
      const decomposition = await exec.think(goal, { workflowId, ...options });
      workflow.decomposition = decomposition;

      for (const step of (decomposition.steps || [])) {
        const subAgent = this.#agents.get(step.agent);
        if (!subAgent) {
          workflow.steps.push({ ...step, status: 'failed', error: `agent ${step.agent} not found` });
          continue;
        }
        await ensureGovernance();
        if (_safety && _audit) {
          _audit.log({ agent: step.agent, action: 'think', resource: 'task', resourceId: step.task.slice(0, 60), details: { workflowId, step }, result: 'started' });
        }
        const stepResult = await subAgent.think(step.task, { workflowId, parent: goal, ...options });
        workflow.steps.push({ ...step, status: 'done', result: stepResult, completed: Date.now() });
        const learn = this.#agents.get('learning');
        if (learn) learn.observeOutcome(goal, step, stepResult).catch(() => {});
      }

      workflow.result = await exec.think({ action: 'consolidate', workflow }, { workflowId });
    } else {
      const firstAgent = this.#agents.values().next().value;
      if (firstAgent) {
        workflow.steps.push({ agent: firstAgent.name, task: goal, status: 'done', result: await firstAgent.think(goal, options) });
      }
    }

    workflow.status = 'completed';
    workflow.completed = Date.now();
    bus.emit('workflow:completed', { workflowId, goal, steps: workflow.steps.length });

    return workflow;
  }

  async ask(agentName, input, context = {}) {
    const agent = this.#agents.get(agentName);
    if (!agent) return { error: `agent ${agentName} not found` };
    return agent.think(input, context);
  }

  getWorkflow(id) {
    return this.#workflows.get(id);
  }

  getRecentWorkflows(limit = 10) {
    return this.#history.slice(-limit);
  }

  getMetrics() {
    return {
      agents: this.#agents.size,
      workflowsCompleted: this.#history.filter(w => w.status === 'completed').length,
      totalWorkflows: this.#history.length,
    };
  }
}

export const orchestrator = new AgentOrchestrator();
export default orchestrator;
