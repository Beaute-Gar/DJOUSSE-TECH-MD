/**
 * AINORIA OS — Cerveau intelligent de DJOUSSE TECH
 * Système de raisonnement, mémoire et agents
 */

const bus = require('../core/eventBus');

class AINORIA {
  constructor() {
    this.status = 'OFFLINE';
    this.version = '1.0.0';
    this.memory = {
      shortTerm: [],
      longTerm: new Map(),
      maxShortTerm: 100,
    };
    this.agents = {
      whatsapp: { status: 'OFFLINE', name: 'WhatsApp Agent' },
      security: { status: 'OFFLINE', name: 'Security Agent' },
      calendar: { status: 'OFFLINE', name: 'Calendar Agent' },
      documents: { status: 'OFFLINE', name: 'Documents Agent' },
    };
    this.goals = { active: [], completed: [] };
    this.tools = new Map();
    this.reasoning = { engine: 'OFFLINE', planning: false, intent: false };
    this.sessionContexts = new Map();
  }

  async initialize() {
    this.status = 'INITIALIZING';
    bus.emit('ainoria:status', { status: 'INITIALIZING' });

    try {
      this.reasoning = { engine: 'READY', planning: true, intent: true };
      Object.keys(this.agents).forEach(k => { this.agents[k].status = 'READY'; });
      this.status = 'ONLINE';
      bus.emit('ainoria:status', { status: 'ONLINE' });
    } catch (e) {
      this.status = 'ERROR';
      bus.emit('ainoria:error', { error: e.message });
    }
  }

  getSessionContext(sessionId) {
    if (!this.sessionContexts.has(sessionId)) {
      this.sessionContexts.set(sessionId, {
        owner: null,
        memory: [],
        permissions: [],
        chatHistory: [],
      });
    }
    return this.sessionContexts.get(sessionId);
  }

  setSessionContext(sessionId, data) {
    const ctx = this.getSessionContext(sessionId);
    Object.assign(ctx, data);
  }

  analyzeIntent(text) {
    if (!text) return { intent: 'unknown', confidence: 0 };
    const lower = text.toLowerCase();
    if (lower.includes('ping') || lower.includes('test')) return { intent: 'system.performance', confidence: 0.95 };
    if (lower.includes('menu') || lower.includes('help')) return { intent: 'system.help', confidence: 0.9 };
    if (lower.includes('sticker') || lower.includes('image')) return { intent: 'media.convert', confidence: 0.85 };
    if (lower.includes('download') || lower.includes('télécharger')) return { intent: 'media.download', confidence: 0.8 };
    if (lower.includes('ai') || lower.includes('intelligence')) return { intent: 'ai.chat', confidence: 0.9 };
    return { intent: 'general', confidence: 0.5 };
  }

  addMemory(type, data) {
    this.memory.shortTerm.push({ type, data, timestamp: Date.now() });
    if (this.memory.shortTerm.length > this.memory.maxShortTerm) {
      this.memory.shortTerm.shift();
    }
  }

  getMemory(type = null) {
    if (type) return this.memory.shortTerm.filter(m => m.type === type);
    return this.memory.shortTerm;
  }

  registerTool(name, tool) {
    this.tools.set(name, tool);
  }

  getTool(name) {
    return this.tools.get(name);
  }

  getStats() {
    return {
      status: this.status,
      version: this.version,
      memory: {
        shortTerm: this.memory.shortTerm.length,
        longTerm: this.memory.longTerm.size,
      },
      agents: Object.entries(this.agents).map(([k, v]) => ({ id: k, ...v })),
      tools: this.tools.size,
      goals: { active: this.goals.active.length, completed: this.goals.completed.length },
      reasoning: this.reasoning,
      sessions: this.sessionContexts.size,
    };
  }
}

module.exports = new AINORIA();
