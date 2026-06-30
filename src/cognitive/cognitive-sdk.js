import { CognitiveAgent, orchestrator } from './agents/agent-framework.js';
import { api } from './cognitive-api.js';

export { CognitiveAgent, orchestrator };

export class AgentBuilder {
  constructor(name) {
    this.def = { name, capabilities: {}, handlers: {} };
  }

  can(ability) {
    const map = {
      observe: 'canObserve', reason: 'canReason', plan: 'canPlan', predict: 'canPredict',
      remember: 'canRemember', search: 'canSearch', act: 'canAct', communicate: 'canCommunicate',
    };
    this.def.capabilities[map[ability] || ability] = true;
    return this;
  }

  cant(ability) {
    const map = {
      observe: 'canObserve', reason: 'canReason', plan: 'canPlan', predict: 'canPredict',
      remember: 'canRemember', search: 'canSearch', act: 'canAct', communicate: 'canCommunicate',
    };
    this.def.capabilities[map[ability] || ability] = false;
    return this;
  }

  requiresApprovalFor(...actions) {
    this.def.capabilities.requiresApproval = actions;
    return this;
  }

  consumesBudget(amount) {
    this.def.capabilities.consumesAIBudget = amount;
    return this;
  }

  onProcess(handler) {
    this.def.handlers.process = handler;
    return this;
  }

  onInit(handler) {
    this.def.handlers.init = handler;
    return this;
  }

  onStart(handler) {
    this.def.handlers.start = handler;
    return this;
  }

  onStop(handler) {
    this.def.handlers.stop = handler;
    return this;
  }

  build() {
    const agent = new CustomAgent(this.def.name, this.def.capabilities, this.def.handlers);
    return agent;
  }

  register() {
    const agent = this.build();
    orchestrator.register(agent);
    return agent;
  }
}

class CustomAgent extends CognitiveAgent {
  constructor(name, capabilities, handlers) {
    super(name, capabilities);
    this._handlers = handlers;
  }

  async process(input, context) {
    if (this._handlers.process) return this._handlers.process(input, context, this);
    throw new Error(`${this.name} has no process handler. Define one with onProcess().`);
  }

  async init() {
    if (this._handlers.init) await this._handlers.init(this);
    return super.init();
  }

  async start() {
    if (this._handlers.start) await this._handlers.start(this);
    return super.start();
  }

  async stop() {
    if (this._handlers.stop) await this._handlers.stop(this);
    return super.stop();
  }
}

export function createAgent(name) {
  return new AgentBuilder(name);
}

export const sdk = { CognitiveAgent, orchestrator, api, createAgent, AgentBuilder };
export default sdk;
