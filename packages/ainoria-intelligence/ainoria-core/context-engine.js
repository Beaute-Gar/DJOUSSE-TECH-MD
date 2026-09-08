import { createLogger } from '../../infrastructure/logger.js';
import { memoryEngine } from './memory-engine.js';

const log = createLogger('CONTEXT-ENGINE');

export class ContextEngine {
  constructor() {
    this.enrichers = [];
    this.ready = false;
  }

  async init() {
    this._registerDefaultEnrichers();
    this.ready = true;
    log.info('Context Engine pret');
  }

  _registerDefaultEnrichers() {
    this.registerEnricher('user_preferences', async (input, ctx) => {
      const jid = ctx.jid;
      if (!jid) return {};
      const prefs = {};
      const keys = ['langue', 'ton', 'horaire_prefere', 'timezone', 'format_date', 'signature'];
      for (const key of keys) {
        const val = memoryEngine.getUserPreference(jid, key);
        if (val !== null) prefs[key] = val;
      }
      return Object.keys(prefs).length > 0 ? { userPreferences: prefs } : {};
    });

    this.registerEnricher('recent_memory', async (input, ctx) => {
      const jid = ctx.jid;
      if (!jid) return {};
      const recent = memoryEngine.recallRecent(jid, null, 5);
      return recent.length > 0 ? { recentMemory: recent.map(m => ({ type: m.type, content: m.content.slice(0, 200), age: Date.now() - m.created_at })) } : {};
    });

    this.registerEnricher('related_memory', async (input, ctx) => {
      const jid = ctx.jid;
      if (!jid || !input) return {};
      const related = await memoryEngine.recallVectorial(jid, typeof input === 'string' ? input : JSON.stringify(input), 3);
      return related.length > 0 ? { relatedMemory: related.map(m => ({ type: m.type, content: m.content.slice(0, 200), score: m.score })) } : {};
    });

    this.registerEnricher('short_term', async (input, ctx) => {
      const jid = ctx.jid;
      if (!jid) return {};
      const st = memoryEngine.getRecentShortTerm(jid);
      return st.length > 0 ? { shortTermContext: st.slice(0, 5).map(e => ({ type: e.type, data: typeof e.data === 'string' ? e.data.slice(0, 200) : '[objet]' })) } : {};
    });
  }

  registerEnricher(name, fn) {
    this.enrichers.push({ name, fn });
  }

  async enrich(input, context = {}) {
    if (!this.ready) await this.init();

    const result = { original: input, ...context, enriched: {}, summary: '' };

    for (const enricher of this.enrichers) {
      try {
        const data = await enricher.fn(input, context);
        Object.assign(result.enriched, data);
      } catch (err) {
        log.warn(`Enricher ${enricher.name}: ${err.message}`);
      }
    }

    const parts = [];
    if (result.enriched.userPreferences) {
      const prefs = result.enriched.userPreferences;
      if (prefs.langue) parts.push(`Langue: ${prefs.langue}`);
      if (prefs.ton) parts.push(`Ton: ${prefs.ton}`);
      if (prefs.timezone) parts.push(`Timezone: ${prefs.timezone}`);
    }
    if (result.enriched.recentMemory?.length) {
      parts.push(`${result.enriched.recentMemory.length} souvenirs récents`);
    }
    if (result.enriched.relatedMemory?.length) {
      parts.push(`${result.enriched.relatedMemory.length} souvenirs pertinents`);
    }

    result.summary = parts.join(' | ');

    return result;
  }

  getStats() {
    return { enrichers: this.enrichers.length, ready: this.ready };
  }
}

export const contextEngine = new ContextEngine();
export default contextEngine;
