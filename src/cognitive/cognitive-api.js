import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';
import { semanticMemory } from './semantic-memory.js';
import { multimodal, CognitiveObject } from './multimodal-engine.js';
import { runtime } from './cognitive-runtime.js';
import { planner } from './planning-engine.js';
import { foresight } from './foresight-engine.js';
import { reasoner } from './reasoning-engine.js';
import { recallGlobal, storeShortTerm } from './memory-engine.js';
import { getContext } from './context-engine.js';
import { evaluate } from './decision-engine.js';
import { createAction } from './automation-engine.js';

const log = createLogger('COGAPI');

/* ════════════════════════════════════════════════════════════
   UNIFIED COGNITIVE API
════════════════════════════════════════════════════════════ */

export class CognitiveAPI {
  async observe(input, options = {}) {
    log.info(`[API] observe(${typeof input === 'string' ? 'text' : 'object'})`);
    const co = await multimodal.perceive(input, options);
    await semanticMemory.rememberConversation(options.author || 'system', [co.summary]);
    bus.emit('cognitive:observed', { id: co.id, type: co.type });
    return co;
  }

  async reason(context, options = {}) {
    log.info(`[API] reason(${typeof context === 'string' ? context.slice(0, 60) : 'object'})`);
    const ctx = typeof context === 'string' ? { text: context } : context;
    const text = ctx.text || ctx.question || ctx.prompt || JSON.stringify(ctx);
    const trace = await reasoner.reason({
      facts: [text],
      rules: ctx.rules || [],
      context: ctx,
      depth: options.depth || 2,
    });
    const decision = await evaluate({ context: text, jid: ctx.jid });
    const reasoning = { trace, decision, context: text, timestamp: Date.now() };
    await semanticMemory.learn('reasoning', {
      context: { question: text, jid: ctx.jid },
      rulesUsed: ctx.rules || ['auto'],
      trace: reasoning,
      outcome: { decision: decision?.action || 'analyzed' },
    });
    return reasoning;
  }

  async plan(goal, options = {}) {
    log.info(`[API] plan(${goal.slice(0, 60)})`);
    const mission = await planner.planFromGoal(goal, options.owner || options.author || null);
    if (options.generateScenarios) {
      const scenarios = await foresight.generateScenarios(goal, options);
      return { mission, scenarios };
    }
    return { mission };
  }

  async predict(query, options = {}) {
    log.info(`[API] predict(${query.slice(0, 60)})`);
    if (options.missionId) {
      return await foresight.predictMission(options.missionId);
    }
    return await foresight.foresightComplete(query, null, options);
  }

  async remember(query, options = {}) {
    log.info(`[API] remember(${query.slice(0, 60)})`);
    const results = { semantic: [], timeline: [], context: null };

    try {
      const semantic = await recallGlobal(query, options.limit || 5);
      if (semantic.length > 0) results.semantic = semantic;
    } catch {}

    try {
      const timeline = semanticMemory.timeline.search(query, options.limit || 5);
      if (timeline.length > 0) results.timeline = timeline;
    } catch {}

    try {
      if (options.jid) {
        results.context = semanticMemory.context.getAll(options.jid);
      }
    } catch {}

    try {
      const meshResults = semanticMemory.mesh.search(query);
      if (meshResults.length > 0) results.mesh = meshResults.slice(0, 5);
    } catch {}

    return results;
  }

  async search(query, options = {}) {
    log.info(`[API] search(${query.slice(0, 60)})`);
    const results = { objects: [], persons: [], missions: [], concepts: [], episodes: [] };

    try {
      const objects = await multimodal.search(query, options.type);
      results.objects = objects.map(o => ({ id: o.id, type: o.type, summary: o.summary?.slice(0, 100), source: o.source }));
    } catch {}

    try {
      const mesh = semanticMemory.mesh.search(query);
      results.concepts = mesh.slice(0, 5).map(m => ({ relation: m.relation, source: `${m.sourceType}:${m.sourceId}` }));
    } catch {}

    try {
      if (options.includeMissions !== false) {
        const missions = planner.getAllMissions().filter(m =>
          m.title.toLowerCase().includes(query.toLowerCase()) ||
          m.tags?.some(t => t.toLowerCase().includes(query.toLowerCase()))
        );
        results.missions = missions.map(m => ({ id: m.id, title: m.title, status: m.status, progress: m.progress }));
      }
    } catch {}

    try {
      const episodes = semanticMemory.episodes.getTimeline(10)
        .filter(e => e.title.toLowerCase().includes(query.toLowerCase()) || e.description.toLowerCase().includes(query.toLowerCase()));
      results.episodes = episodes.map(e => ({ id: e.id, type: e.type, title: e.title }));
    } catch {}

    try {
      const concepts = semanticMemory.concepts.getAll().filter(c => c.name.toLowerCase().includes(query.toLowerCase()));
      results.concepts.push(...concepts.map(c => ({ id: c.id, name: c.name, type: c.type, strength: c.strength })));
    } catch {}

    return results;
  }

  async act(action, options = {}) {
    log.info(`[API] act(${action.type || action})`);
    const result = { action, status: 'executed', timestamp: Date.now(), details: null };

    if (action.type === 'message') {
      result.details = { to: action.to, content: action.content };
    } else if (action.type === 'create_mission') {
      const mission = await planner.planFromGoal(action.goal, action.owner);
      result.details = { missionId: mission.id, title: mission.title };
    } else if (action.type === 'update_mission') {
      const mission = planner.updateMission(action.missionId, action.updates);
      result.details = mission ? { id: mission.id, status: mission.status } : null;
    } else if (action.type === 'execute_task') {
      const mission = await planner.executeTask(action.missionId, action.taskId, { status: 'completed' });
      result.details = mission ? { progress: mission.progress } : null;
    } else if (action.type === 'simulate') {
      result.details = await foresight.simulate(action, options);
    } else if (action.type === 'store_context') {
      semanticMemory.context.set(options.jid || 'system', action.key, action.value, options);
      result.details = { key: action.key };
    } else if (action.type === 'create_concept') {
      result.details = semanticMemory.concepts.create(action.name, action.type, action.aliases);
    } else if (action.type === 'strengthen_concept') {
      result.details = semanticMemory.concepts.strengthen(action.name, action.amount || 1);
    } else if (action.type === 'create_action') {
      result.details = await createAction({ type: 'custom', jid: options.jid, title: action.title, priority: action.priority || 2 });
    } else {
      result.status = 'unknown_action';
    }

    bus.emit('cognitive:action', { action: action.type, status: result.status });
    return result;
  }

  async analyze(input, options = {}) {
    log.info(`[API] analyze(...)`);
    const co = await this.observe(input, options);
    const reasoning = await this.reason({ text: co.summary, jid: options.jid }, options);
    const prediction = await this.predict(co.summary, options);
    return { object: co.toJSON(), reasoning, prediction };
  }
}

export const api = new CognitiveAPI();
export default api;
