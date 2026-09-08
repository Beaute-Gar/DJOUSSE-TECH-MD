import { createLogger } from '../../infrastructure/logger.js';
import { toolEngine } from './tool-engine.js';
import { permissionsEngine } from './permissions-engine.js';
import { skillManager } from './skill-manager.js';
import { agentOrchestrator } from './agent-orchestrator.js';
import { eventBusV2 } from './event-bus-v2.js';
import { memoryEngine } from './memory-engine.js';

const log = createLogger('SDK');

class AinoriaPlugin {
  constructor(name, version = '1.0') {
    this.name = name;
    this.version = version;
    this.tools = [];
    this.skills = [];
    this.agents = [];
    this.permissions = [];
    this.eventHandlers = [];
    this.started = false;
  }

  registerTool(toolDef) {
    toolEngine.register({ ...toolDef, plugin: this.name });
    this.tools.push(toolDef.name);
    return this;
  }

  registerSkill(skillDef) {
    skillManager.install(skillDef.name, { ...skillDef, version: this.version });
    this.skills.push(skillDef.name);
    return this;
  }

  registerAgent(agentDef) {
    agentOrchestrator.registerAgent({ ...agentDef, plugin: this.name });
    this.agents.push(agentDef.name);
    return this;
  }

  registerPermission(agentName, permission) {
    permissionsEngine.grant(agentName, permission);
    this.permissions.push({ agent: agentName, permission });
    return this;
  }

  on(event, handler, opts = {}) {
    const subId = eventBusV2.on(event, handler, { ...opts, plugin: this.name });
    this.eventHandlers.push(subId);
    return this;
  }

  onMessage(handler) {
    return this.on('message', handler);
  }

  onToolCall(handler) {
    return this.on('tool:execute', handler);
  }

  async start() {
    if (this.started) return;
    this.started = true;
    eventBusV2.emit('plugin:start', { name: this.name, version: this.version });
    log.info(`Plugin demarre: ${this.name} v${this.version}`);
    return this;
  }

  async stop() {
    if (!this.started) return;
    for (const subId of this.eventHandlers) eventBusV2.off(subId);
    this.started = false;
    eventBusV2.emit('plugin:stop', { name: this.name });
    log.info(`Plugin arrete: ${this.name}`);
    return this;
  }
}

const activePlugins = new Map();

export function createPlugin(name, version) {
  if (activePlugins.has(name)) {
    log.warn(`Plugin ${name} deja charge`);
    return activePlugins.get(name);
  }
  const plugin = new AinoriaPlugin(name, version);
  activePlugins.set(name, plugin);
  return plugin;
}

export function getPlugin(name) {
  return activePlugins.get(name) || null;
}

export function listPlugins() {
  return Array.from(activePlugins.values()).map(p => ({
    name: p.name, version: p.version, started: p.started,
    tools: p.tools.length, skills: p.skills.length, agents: p.agents.length,
  }));
}

export async function stopAllPlugins() {
  for (const plugin of activePlugins.values()) await plugin.stop();
}

export { AinoriaPlugin };
export default { createPlugin, getPlugin, listPlugins, stopAllPlugins };
