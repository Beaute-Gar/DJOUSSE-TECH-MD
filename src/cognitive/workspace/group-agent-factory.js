import { CognitiveAgent, orchestrator } from '../agents/agent-framework.js';
import { groupStore } from './group-cognitive-object.js';
import { createLogger } from '../../core/logger.js';
import { bus } from '../event-bus.js';
import { api } from '../cognitive-api.js';

const log = createLogger('GROUPFACTORY');

const AGENT_PROFILES = [
  { keywords: ['erp', 'compta', 'finance', 'business', 'projet', 'gestion'], type: 'erp', desc: 'Gestion ERP et finances' },
  { keywords: ['support', 'help', 'aide', 'assistance', 'service client', 'sav'], type: 'support', desc: 'Support et assistance' },
  { keywords: ['dev', 'code', 'programmation', 'tech', 'informatique', 'developer'], type: 'developer', desc: 'Développement technique' },
  { keywords: ['marketing', 'vente', 'commercial', 'pub', 'promotion'], type: 'marketing', desc: 'Marketing et ventes' },
  { keywords: ['famille', 'family', 'maison', 'perso', 'prive'], type: 'family', desc: 'Gestion familiale' },
  { keywords: ['anime', 'manga', 'otaku', 'jeu', 'gaming', 'game'], type: 'entertainment', desc: 'Divertissement' },
  { keywords: ['sante', 'health', 'medical', 'bien-etre', 'fitness'], type: 'health', desc: 'Santé et bien-être' },
  { keywords: ['legal', 'juridique', 'droit', 'avocat', 'loi'], type: 'legal', desc: 'Conseil juridique' },
];

class GroupAgent extends CognitiveAgent {
  constructor(name, groupJid, groupSubject, ws, agentType) {
    super(name, {
      canObserve: true,
      canReason: true,
      canPlan: true,
      canPredict: true,
      canRemember: true,
      canSearch: true,
      canAct: false,
      canCommunicate: true,
      consumesAIBudget: 1,
    });
    this.groupJid = groupJid;
    this.groupSubject = groupSubject;
    this.workspace = ws;
    this.agentType = agentType || 'general';
    this.groupObject = groupStore.getOrCreate(groupJid, { subject: groupSubject });
  }

  async process(input, context = {}) {
    const text = typeof input === 'string' ? input : input.text || JSON.stringify(input);
    this.groupObject.recordMessage(context.author || 'system', text, 'command').catch(() => {});
    if (this.workspace) this.workspace.stats.messagesProcessed++;

    const { action, query } = this._parse(text);
    switch (action) {
      case 'resume':
        return this._groupSummary();
      case 'decide':
        return this._makeDecision(query, context);
      case 'objective':
        return this._addObjective(query);
      case 'rule':
        return this._addRule(query);
      default:
        return this._handleGeneral(input, context);
    }
  }

  _parse(text) {
    const lower = text.toLowerCase();
    if (lower.startsWith('resume') || lower.startsWith('résumé')) return { action: 'resume' };
    if (lower.startsWith('decide ') || lower.startsWith('décide ')) return { action: 'decide', query: text.replace(/^decide |^décide /i, '') };
    if (lower.startsWith('objective ') || lower.startsWith('objectif ')) return { action: 'objective', query: text.replace(/^objective |^objectif /i, '') };
    if (lower.startsWith('rule ') || lower.startsWith('règle ')) return { action: 'rule', query: text.replace(/^rule |^règle /i, '') };
    return { action: 'general' };
  }

  async _groupSummary() {
    const summary = this.groupObject.getSummary();
    return {
      group: this.groupSubject,
      type: this.agentType,
      members: summary.size,
      messages: summary.messagesTotal,
      decisions: summary.decisions,
      objectives: summary.objectives,
      identity: summary.identity,
    };
  }

  async _makeDecision(query, context) {
    const reasoning = await this.reason({
      text: `Décision pour le groupe "${this.groupSubject}": ${query}`,
      rules: ['group_decision', 'consensus'],
    });
    this.groupObject.recordDecision(reasoning.trace?.conclusion || query, context);
    return { decision: reasoning.trace?.conclusion || 'Decision recorded', group: this.groupSubject };
  }

  async _addObjective(query) {
    this.groupObject.addObjective(query);
    return { objective: query, group: this.groupSubject, status: 'added' };
  }

  async _addRule(query) {
    this.groupObject.addRule(query);
    return { rule: query, group: this.groupSubject, status: 'added' };
  }

  async _handleGeneral(input, context) {
    const observed = await this.observe(input, { jid: this.groupJid });
    return {
      observed: observed?.summary || input,
      group: this.groupSubject,
      type: this.agentType,
    };
  }

  async getStatus() {
    const base = await super.getStatus();
    return { ...base, groupJid: this.groupJid, groupSubject: this.groupSubject, agentType: this.agentType };
  }
}

export class GroupAgentFactory {
  #created = new Set();

  createForGroup(sock, groupJid, groupSubject, ws) {
    if (this.#created.has(groupJid)) return;
    this.#created.add(groupJid);

    const profile = AGENT_PROFILES.find(p =>
      p.keywords.some(k => groupSubject.toLowerCase().includes(k))
    ) || { type: 'general', desc: 'Agent généraliste' };

    const agentName = `${profile.type}:${groupSubject.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)}`;
    const agent = new GroupAgent(agentName, groupJid, groupSubject, ws, profile.type);

    orchestrator.register(agent);
    ws.stats.agentsActive++;
    groupStore.getOrCreate(groupJid, { subject: groupSubject, isAdmin: true });

    agent.start().catch(err => log.warn(`[GROUPFACTORY] start ${agentName}: ${err.message}`));
    bus.emit('group:agent_created', { groupJid, subject: groupSubject, agent: agentName, type: profile.type });
    log.info(`[GROUPFACTORY] Created ${profile.type} agent for "${groupSubject}"`);
    return agent;
  }

  getAgentsByWorkspace(ws) {
    return Array.from(orchestrator.list()).filter(a =>
      a.name?.includes(':') && ws.groups.has(a.groupJid)
    );
  }

  async getStats() {
    const all = await orchestrator.list();
    const groupAgents = all.filter(a => a.groupJid);
    const byType = {};
    for (const a of groupAgents) {
      byType[a.agentType] = (byType[a.agentType] || 0) + 1;
    }
    return { total: groupAgents.length, byType };
  }
}

export const groupFactory = new GroupAgentFactory();
export default groupFactory;
