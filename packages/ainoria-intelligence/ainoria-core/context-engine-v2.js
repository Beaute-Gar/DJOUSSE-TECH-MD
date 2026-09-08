import { createLogger } from '../../infrastructure/logger.js';
import { memoryEngine } from './memory-engine.js';
import { toolEngine } from './tool-engine.js';
import { agentOrchestrator } from './agent-orchestrator.js';
import { permissionsEngine } from './permissions-engine.js';
import { worldModel } from './world-model.js';
import { rawGet, rawAll } from '../../infrastructure/database/database.js';

const log = createLogger('CTX-V2');

export class ContextEngineV2 {
  constructor() {
    this.ready = false;
  }

  async init() {
    this.ready = true;
    log.info('Context Engine V2 pret');
  }

  async buildContext(input, context = {}) {
    if (!this.ready) await this.init();
    const jid = context.jid || context.senderJid || 'unknown';
    const start = Date.now();
    const sources = {};

    sources.temporal = this._getTemporal();
    sources.input = { raw: typeof input === 'string' ? input.slice(0, 2000) : JSON.stringify(input).slice(0, 2000), type: typeof input };

    if (jid !== 'unknown') {
      sources.userPreferences = this._getUserPreferences(jid);
      sources.shortTerm = this._getShortTerm(jid);
      sources.recentMemory = this._getRecentMemory(jid);
      sources.longTermMemory = await this._getVectorialMemory(jid, input);
      sources.worldEntity = worldModel.getEntity(jid);
      sources.contacts = worldModel.getContacts(jid, 10);
      sources.groups = worldModel.getGroupsForContact(jid, 5);
      sources.goals = this._getActiveGoals(jid);
    }

    sources.availableTools = toolEngine.list().map(t => ({ name: t.name, description: t.description, category: t.category }));
    sources.availableAgents = agentOrchestrator.list().map(a => ({ name: a.name, scope: a.scope, state: a.state }));
    sources.permissions = permissionsEngine.initialized;
    sources.integrations = this._getIntegrations();
    sources.conversationHistory = this._getConversationHistory(jid, context.conversationId);

    const fused = {
      jid,
      agentName: context.agentName || null,
      conversationId: context.conversationId || null,
      isGroup: context.isGroup || jid.includes('@g.us'),
      sources,
      stats: { totalSources: Object.keys(sources).length, buildTime: Date.now() - start },
    };

    fused.summary = this._buildSummary(fused);
    return fused;
  }

  _getTemporal() {
    const now = new Date();
    return {
      timestamp: now.toISOString(),
      unix: Date.now(),
      hour: now.getHours(),
      minute: now.getMinutes(),
      dayOfWeek: now.getDay(),
      dayOfMonth: now.getDate(),
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isMorning: now.getHours() >= 5 && now.getHours() < 12,
      isAfternoon: now.getHours() >= 12 && now.getHours() < 18,
      isEvening: now.getHours() >= 18 && now.getHours() < 22,
      isNight: now.getHours() >= 22 || now.getHours() < 5,
      isWeekend: [0, 6].includes(now.getDay()),
    };
  }

  _getUserPreferences(jid) {
    const prefs = {};
    const keys = ['langue', 'ton', 'horaire_prefere', 'timezone', 'format_date', 'signature', 'mode_nuit', 'notifications', 'langue_ia'];
    for (const key of keys) {
      const val = memoryEngine.getUserPreference(jid, key);
      if (val !== null) prefs[key] = val;
    }
    return prefs;
  }

  _getShortTerm(jid) {
    return memoryEngine.getRecentShortTerm(jid).slice(0, 10);
  }

  _getRecentMemory(jid) {
    try {
      return memoryEngine.recallRecent(jid, null, 10).map(m => ({
        id: m.id, type: m.type, content: m.content.slice(0, 300), age: Date.now() - m.created_at,
      }));
    } catch { return []; }
  }

  async _getVectorialMemory(jid, input) {
    if (!input) return [];
    try {
      const text = typeof input === 'string' ? input : JSON.stringify(input);
      const results = await memoryEngine.recallVectorial(jid, text, 5);
      return results.map(m => ({ id: m.id, type: m.type, content: m.content.slice(0, 300), score: m.score }));
    } catch { return []; }
  }

  _getActiveGoals(jid) {
    try {
      return rawAll("SELECT id, title, status, priority, created_at FROM ainoria_goals WHERE jid = ? AND status != 'completed' ORDER BY priority DESC LIMIT 10", jid);
    } catch { return []; }
  }

  _getIntegrations() {
    const integrations = [];
    if (process.env.GEMINI_API_KEY) integrations.push('gemini');
    if (process.env.GROQ_API_KEY) integrations.push('groq');
    if (process.env.GOOGLE_CLIENT_ID) integrations.push('google_oauth');
    if (process.env.WHATSAPP_TOKEN) integrations.push('whatsapp_cloud_api');
    return integrations;
  }

  _getConversationHistory(jid, conversationId) {
    try {
      if (conversationId) {
        return rawAll('SELECT role, content, created_at FROM ainoria_conversations WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 20', conversationId);
      }
      if (jid) {
        return rawAll('SELECT role, content, created_at FROM ainoria_conversations WHERE jid = ? ORDER BY created_at DESC LIMIT 20', jid);
      }
    } catch {}
    return [];
  }

  _buildSummary(ctx) {
    const parts = [];
    const s = ctx.sources;
    if (s.temporal) {
      const t = s.temporal;
      parts.push(`${t.hour}h${String(t.minute).padStart(2, '0')}`);
      if (t.isMorning) parts.push('matin');
      else if (t.isAfternoon) parts.push('apres-midi');
      else if (t.isEvening) parts.push('soir');
      else parts.push('nuit');
    }
    if (s.userPreferences?.langue) parts.push(`lang:${s.userPreferences.langue}`);
    if (s.userPreferences?.ton) parts.push(`ton:${s.userPreferences.ton}`);
    if (s.recentMemory?.length) parts.push(`${s.recentMemory.length} souvenirs`);
    if (s.longTermMemory?.length) parts.push(`${s.longTermMemory.length} pertinents`);
    if (s.contacts?.length) parts.push(`${s.contacts.length} contacts`);
    if (s.groups?.length) parts.push(`${s.groups.length} groupes`);
    if (s.goals?.length) parts.push(`${s.goals.length} objectifs`);
    if (s.availableTools?.length) parts.push(`${s.availableTools.length} outils`);
    if (s.availableAgents?.length) parts.push(`${s.availableAgents.length} agents`);
    return parts.join(' | ');
  }

  getStats() {
    return { ready: this.ready };
  }
}

export const contextEngineV2 = new ContextEngineV2();
export default contextEngineV2;
