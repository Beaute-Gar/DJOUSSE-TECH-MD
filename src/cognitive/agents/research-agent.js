import { CognitiveAgent } from './agent-framework.js';
import { createLogger } from '../../core/logger.js';
import { api } from '../cognitive-api.js';
import { semanticMemory } from '../semantic-memory.js';

const log = createLogger('RESEARCH');

export class ResearchAgent extends CognitiveAgent {
  constructor() {
    super('research', {
      canObserve: true,
      canReason: true,
      canPlan: false,
      canPredict: true,
      canRemember: true,
      canSearch: true,
      canAct: false,
      canCommunicate: false,
      requiresApproval: [],
      consumesAIBudget: 2,
    });
    this.cache = new Map();
  }

  async process(input, context = {}) {
    log.info(`[RESEARCH] processing: ${typeof input === 'string' ? input.slice(0, 80) : 'object'}`);

    const { action, query, task, type } = typeof input === 'string'
      ? this.#parseInput(input) : input;

    switch (action) {
      case 'query':       return this.#deepQuery(query || task, context);
      case 'explain':     return this.#explain(query || task, context);
      case 'compare':     return this.#compare(query || task, context);
      case 'timeline':    return this.#buildTimeline(query || task, context);
      case 'insight':     return this.#generateInsights(query || task, context);
      case 'related':     return this.#findRelated(query || task, context);
      case 'summarize':   return this.#summarizeKnowledge(query || task, context);
      default:            return this.#deepQuery(input, context);
    }
  }

  #parseInput(input) {
    const lower = input.toLowerCase();
    if (lower.startsWith('query ') || lower.startsWith('search ') || lower.startsWith('find ')) return { action: 'query', query: input.replace(/^(query|search|find)\s+/i, '') };
    if (lower.startsWith('explain ') || lower.startsWith('what is ') || lower.startsWith('what are ')) return { action: 'explain', query: input.replace(/^(explain|what is|what are)\s+/i, '') };
    if (lower.startsWith('compare ')) return { action: 'compare', query: input.replace(/^compare\s+/i, '') };
    if (lower.startsWith('timeline ') || lower.startsWith('history ')) return { action: 'timeline', query: input.replace(/^(timeline|history)\s+/i, '') };
    if (lower.startsWith('insight') || lower.startsWith('trend')) return { action: 'insight', query: input.replace(/^(insight|trend)\s+/i, '') };
    if (lower.startsWith('related ')) return { action: 'related', query: input.replace(/^related\s+/i, '') };
    if (lower.startsWith('summarize ')) return { action: 'summarize', query: input.replace(/^summarize\s+/i, '') };
    return { action: 'query', query: input };
  }

  async #deepQuery(query, context) {
    const cacheKey = `q:${query}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    const results = await api.search(query, { includeMissions: true, ...context });
    const memory = await api.remember(query, { limit: 10, jid: context.jid });
    const prediction = await api.predict(query, context).catch(() => null);

    const combined = {
      query,
      sources: {
        objects: results.objects || [],
        persons: results.persons || [],
        missions: results.missions || [],
        concepts: results.concepts || [],
        episodes: results.episodes || [],
        semantic: memory.semantic || [],
        timeline: memory.timeline || [],
        mesh: memory.mesh || [],
      },
      prediction,
      confidence: results.objects?.length > 0 ? 0.9 : 0.5,
      timestamp: Date.now(),
    };

    const contexts = semanticMemory.context?.getAll?.(context.jid) || {};
    combined.contextMemory = Object.keys(contexts).slice(0, 5).reduce((acc, k) => {
      acc[k] = typeof contexts[k] === 'string' ? contexts[k].slice(0, 200) : 'complex';
      return acc;
    }, {});

    if (results.objects?.length > 0 || memory.semantic?.length > 0) {
      this.cache.set(cacheKey, combined);
      setTimeout(() => this.cache.delete(cacheKey), 60000);
    }

    return combined;
  }

  async #explain(query, context) {
    const data = await this.#deepQuery(query, context);
    const reasoning = await this.reason({
      text: `Explique ce sujet de manière claire: "${query}".\nDonnées disponibles: ${JSON.stringify(data.sources).slice(0, 500)}`,
      rules: ['explanation', 'pedagogy'],
    }, { depth: 2 });

    return {
      query,
      explanation: reasoning.trace?.conclusion || 'Unable to explain',
      sources: { total: data.sources.objects?.length + data.sources.concepts?.length },
      confidence: data.confidence,
      reasoning: reasoning.trace,
    };
  }

  async #compare(query, context) {
    const items = query.split(/\s+(vs|and|,)\s+/i).filter(Boolean);
    const results = {};
    for (const item of items) {
      results[item] = await this.#deepQuery(item, context);
    }

    const reasoning = await this.reason({
      text: `Compare ces éléments:\n${items.map(i => `- ${i}: ${JSON.stringify(results[i]?.sources).slice(0, 300)}`).join('\n')}\n\nProduis une analyse comparative.`,
      rules: ['comparison', 'analysis'],
    }, { depth: 2 });

    return {
      items,
      comparison: reasoning.trace?.conclusion || 'Comparison completed',
      details: results,
    };
  }

  async #buildTimeline(query, context) {
    const memory = await api.remember(query, { limit: 20 });
    const timeline = memory.timeline || [];

    const reasoning = await this.reason({
      text: `Organise cette chronologie: ${JSON.stringify(timeline.slice(0, 10))}\nContexte: ${query}`,
      rules: ['timeline', 'organization'],
    }, { depth: 1 });

    return {
      query,
      timeline,
      summary: reasoning.trace?.conclusion || 'Timeline built',
      events: timeline.length,
    };
  }

  async #generateInsights(query, context) {
    const data = await this.#deepQuery(query, context);
    const trends = await api.predict('trends:' + query, context).catch(() => null);

    return {
      query,
      insights: {
        patterns: data.semantic?.slice(0, 3).map(s => ({ content: s.slice(0, 150), source: 'memory' })),
        predictions: trends?.scenarios ? trends.scenarios.slice(0, 2) : [],
        recommendations: data.concepts?.slice(0, 3).map(c => c.name),
      },
      dataPoints: data.sources.objects?.length + data.sources.concepts?.length,
    };
  }

  async #findRelated(query, context) {
    const data = await api.search(query, { includeMissions: true });
    const mesh = semanticMemory.mesh?.search?.(query) || [];

    const related = {
      query,
      concepts: mesh.slice(0, 5).map(m => ({ relation: m.relation, source: `${m.sourceType}:${m.sourceId}` })),
      missions: data.missions?.slice(0, 3) || [],
      persons: data.persons?.slice(0, 3) || [],
      connections: mesh.length,
    };

    return related;
  }

  async #summarizeKnowledge(query, context) {
    const data = await this.#deepQuery(query, context);
    const summary = await this.reason({
      text: `Résume ces connaissances: ${JSON.stringify(data.sources).slice(0, 1000)}\nContexte: ${query}`,
      rules: ['summarization', 'concision'],
    }, { depth: 1 });

    return {
      query,
      summary: summary.trace?.conclusion || 'No summary available',
      sourcesCount: {
        objects: data.sources.objects?.length || 0,
        concepts: data.sources.concepts?.length || 0,
        missions: data.sources.missions?.length || 0,
        episodes: data.sources.episodes?.length || 0,
      },
    };
  }
}

export const research = new ResearchAgent();
export default research;
