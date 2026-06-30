import { CognitiveAgent } from './agent-framework.js';
import { createLogger } from '../../core/logger.js';
import { api } from '../cognitive-api.js';
import { bus, EVENTS } from '../event-bus.js';

const log = createLogger('LEARN');

export class LearningAgent extends CognitiveAgent {
  constructor() {
    super('learning', {
      canObserve: true,
      canReason: true,
      canPlan: false,
      canPredict: true,
      canRemember: true,
      canSearch: true,
      canAct: true,
      canCommunicate: false,
      requiresApproval: [],
      consumesAIBudget: 2,
    });
    this.outcomes = [];
    this.models = { user: new Map(), system: new Map(), concept: new Map() };
    this.feedback = [];
    this.patterns = [];
    this.preferences = new Map();

    bus.on('executive:decided', this.#onDecision.bind(this));
    bus.on('communication:analyzed', this.#onCommunication.bind(this));
    bus.on('workflow:completed', this.#onWorkflowComplete.bind(this));
  }

  async process(input, context = {}) {
    log.info(`[LEARN] processing: ${typeof input === 'string' ? input.slice(0, 80) : 'object'}`);

    const { action, task, outcome, feedback } = typeof input === 'string'
      ? this.#parseInput(input) : input;

    switch (action) {
      case 'observe':     return this.#observeAndLearn(task || input, context);
      case 'feedback':    return this.#incorporateFeedback(feedback || task, context);
      case 'adapt':       return this.#adaptBehavior(task || input, context);
      case 'insights':    return this.#getLearningInsights(task || context);
      case 'preference':  return this.#learnPreference(task || input, context);
      case 'pattern':     return this.#detectPattern(task || input, context);
      default:            return this.#observeAndLearn(input, context);
    }
  }

  #parseInput(input) {
    const lower = input.toLowerCase();
    if (lower.startsWith('observe ') || lower.startsWith('learn ')) return { action: 'observe', task: input.replace(/^(observe|learn)\s+/i, '') };
    if (lower.startsWith('feedback ') || lower.startsWith('correct ')) return { action: 'feedback', task: input.replace(/^(feedback|correct)\s+/i, '') };
    if (lower.startsWith('adapt ')) return { action: 'adapt', task: input.replace(/^adapt\s+/i, '') };
    if (lower.startsWith('insights ') || lower.startsWith('knowledge ')) return { action: 'insights', task: input.replace(/^(insights|knowledge)\s+/i, '') };
    if (lower.startsWith('preference ')) return { action: 'preference', task: input.replace(/^preference\s+/i, '') };
    if (lower.startsWith('pattern ')) return { action: 'pattern', task: input.replace(/^pattern\s+/i, '') };
    return { action: 'observe', task: input };
  }

  async #observeAndLearn(input, context) {
    const observed = typeof input === 'object' ? input : { text: input, context };

    const reasoning = await this.reason({
      text: `Apprend de cette observation:\n${JSON.stringify(observed).slice(0, 1000)}\n\nExtrais: patterns, décisions à renforcer, comportements à ajuster.`,
      rules: ['learning', 'pattern_extraction'],
    }, { depth: 2 });

    const outcome = {
      input: observed,
      learned: reasoning.trace?.conclusion || 'Observed',
      patterns: this.#extractPatterns(reasoning),
      reinforcements: this.#extractReinforcements(reasoning),
      timestamp: Date.now(),
    };

    this.outcomes.push(outcome);
    if (this.outcomes.length > 500) this.outcomes.shift();

    for (const p of outcome.patterns) {
      this.#learnPattern(p);
    }

    for (const r of outcome.reinforcements) {
      await api.act({ type: 'strengthen_concept', name: r, amount: 0.5 });
    }

    await api.act({ type: 'store_context', key: `learning:${Date.now()}`, value: outcome });
    this.emit('learning:observed', { patterns: outcome.patterns.length });
    return outcome;
  }

  async observeOutcome(goal, step, result) {
    return this.#observeAndLearn({ goal: typeof goal === 'string' ? goal : goal.goal, step, result }, {});
  }

  #extractPatterns(reasoning) {
    const conclusion = typeof reasoning.trace?.conclusion === 'string' ? reasoning.trace.conclusion : '';
    const patterns = [];
    const patternKeywords = ['toujours', 'souvent', 'chaque', 'systématique', 'jamais', 'rarement', 'pattern', 'always', 'often', 'never'];
    for (const kw of patternKeywords) {
      if (conclusion.toLowerCase().includes(kw)) {
        patterns.push({ keyword: kw, context: conclusion.slice(0, 200) });
      }
    }
    return patterns;
  }

  #extractReinforcements(reasoning) {
    const conclusion = typeof reasoning.trace?.conclusion === 'string' ? reasoning.trace.conclusion : '';
    const reinforcements = [];
    const actionWords = ['créer', 'planifier', 'analyser', 'rechercher', 'communiquer', 'create', 'plan', 'analyze'];
    for (const word of actionWords) {
      if (conclusion.toLowerCase().includes(word)) {
        reinforcements.push(word);
      }
    }
    return reinforcements;
  }

  #learnPattern(pattern) {
    const key = pattern.keyword;
    if (!this.models.system.has(key)) {
      this.models.system.set(key, { count: 0, contexts: [] });
    }
    const model = this.models.system.get(key);
    model.count++;
    model.contexts.push(pattern.context);
    if (model.contexts.length > 50) model.contexts.shift();
  }

  async #incorporateFeedback(feedback, context) {
    const entry = {
      feedback: typeof feedback === 'string' ? feedback : JSON.stringify(feedback),
      context,
      timestamp: Date.now(),
    };
    this.feedback.push(entry);
    if (this.feedback.length > 200) this.feedback.shift();

    const reasoning = await this.reason({
      text: `Feedback reçu: "${entry.feedback}"\nContexte: ${JSON.stringify(context)}\n\nQuel ajustement doit être fait? Quelle décision précédente doit être corrigée?`,
      rules: ['feedback_analysis', 'correction'],
    }, { depth: 2 });

    const correction = {
      feedback: entry.feedback,
      adjustment: reasoning.trace?.conclusion || 'Noted',
      requiresUserAction: this.#needsUserAction(reasoning),
      timestamp: Date.now(),
    };

    await api.act({ type: 'store_context', key: `correction:${Date.now()}`, value: correction });
    this.emit('learning:corrected', { hasAdjustment: correction.adjustment.length > 0 });
    return correction;
  }

  #needsUserAction(reasoning) {
    const conclusion = typeof reasoning.trace?.conclusion === 'string' ? reasoning.trace.conclusion.toLowerCase() : '';
    return conclusion.includes('modifier') || conclusion.includes('changer') || conclusion.includes('corriger');
  }

  async #adaptBehavior(input, context) {
    const history = this.outcomes.slice(-20);

    const reasoning = await this.reason({
      text: `Analyse l'historique d'apprentissage:\n${JSON.stringify(history.slice(-10))}\nNouveau contexte: ${typeof input === 'string' ? input : JSON.stringify(input)}\n\nComment adapter le comportement du système?`,
      rules: ['adaptation', 'behavior_adjustment'],
    }, { depth: 2 });

    const adaptation = {
      input,
      recommendation: reasoning.trace?.conclusion || 'No adaptation needed',
      confidence: reasoning.trace?.confidence || 0.5,
      basedOnHistory: history.length,
      timestamp: Date.now(),
    };

    this.emit('learning:adapted', adaptation);
    return adaptation;
  }

  async #getLearningInsights(context) {
    const topPatterns = Array.from(this.models.system.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([key, model]) => ({ pattern: key, frequency: model.count, examples: model.contexts.slice(-2) }));

    const recentFeedback = this.feedback.slice(-5).map(f => ({
      feedback: typeof f.feedback === 'string' ? f.feedback.slice(0, 100) : 'complex',
      time: f.timestamp,
    }));

    return {
      patterns: topPatterns,
      totalObservations: this.outcomes.length,
      totalFeedback: this.feedback.length,
      recentFeedback,
      userPreferences: Array.from(this.preferences.entries()).map(([k, v]) => ({ key: k, value: v })),
      outcomeTrend: this.#calculateTrend(),
    };
  }

  #calculateTrend() {
    const recent = this.outcomes.slice(-20);
    if (recent.length < 2) return { direction: 'stable', confidence: 0 };
    const mid = Math.floor(recent.length / 2);
    const firstHalf = recent.slice(0, mid);
    const secondHalf = recent.slice(mid);
    if (firstHalf.length === 0 || secondHalf.length === 0) return { direction: 'stable', confidence: 0 };
    return { direction: secondHalf.length >= firstHalf.length ? 'improving' : 'declining', confidence: 0.6 };
  }

  async #learnPreference(input, context) {
    const key = context.key || (typeof input === 'string' ? input : 'preference');
    const value = context.value || (typeof input === 'string' ? { text: input } : input);
    this.preferences.set(key, { value, confidence: context.confidence || 0.7, learned: Date.now() });

    await api.act({
      type: 'store_context',
      key: `preference:${key}`,
      value: { key, value, confidence: context.confidence || 0.7 },
    });

    this.emit('learning:preference', { key });
    return { key, stored: true };
  }

  async #detectPattern(input, context) {
    const data = typeof input === 'string'
      ? this.outcomes.filter(o => JSON.stringify(o).toLowerCase().includes(input.toLowerCase()))
      : this.outcomes;

    const reasoning = await this.reason({
      text: `Analyse ces données pour détecter des patterns:\n${JSON.stringify(data.slice(-10))}`,
      rules: ['pattern_detection', 'data_mining'],
    }, { depth: 2 });

    const detected = {
      query: input,
      patterns: reasoning.trace?.patterns || [reasoning.trace?.conclusion || 'No patterns detected'],
      dataPoints: data.length,
      confidence: reasoning.trace?.confidence || 0.4,
    };

    this.patterns.push(detected);
    return detected;
  }

  #onDecision(data) {
    this.#observeAndLearn({ type: 'decision', id: data.id }, {}).catch(() => {});
  }

  #onCommunication(data) {
    if (data.intent && data.urgency > 3) {
      this.#observeAndLearn({ type: 'urgent_communication', intent: data.intent, urgency: data.urgency }, {}).catch(() => {});
    }
  }

  #onWorkflowComplete(data) {
    this.#observeAndLearn({ type: 'workflow', workflowId: data.workflowId, goal: data.goal, steps: data.steps }, {}).catch(() => {});
  }

  getPreference(key) {
    return this.preferences.get(key);
  }

  getModelSummary() {
    return {
      patterns: this.models.system.size,
      outcomes: this.outcomes.length,
      feedback: this.feedback.length,
      preferences: this.preferences.size,
    };
  }
}

export const learning = new LearningAgent();
export default learning;
