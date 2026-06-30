import { CognitiveAgent } from './agent-framework.js';
import { createLogger } from '../../core/logger.js';
import { bus, EVENTS } from '../event-bus.js';
import { api } from '../cognitive-api.js';

const log = createLogger('EXEC');

export class ExecutiveAgent extends CognitiveAgent {
  constructor() {
    super('executive', {
      canObserve: true,
      canReason: true,
      canPlan: true,
      canPredict: true,
      canRemember: true,
      canSearch: true,
      canAct: true,
      canCommunicate: true,
      requiresApproval: ['execute_task', 'update_mission', 'create_mission', 'send_message', 'financial'],
      consumesAIBudget: 3,
    });
    this.activeWorkflows = new Map();
    this.conflictLog = [];
    this.decisions = [];
    this.on('workflow:completed', this.#onWorkflowDone.bind(this));
    this.on('agent:error', this.#onAgentError.bind(this));
  }

  async process(input, context = {}) {
    log.info(`[EXEC] processing: ${typeof input === 'string' ? input.slice(0, 80) : 'object'}`);

    const { action, goal, task, command } = typeof input === 'string'
      ? this.#parseInput(input) : input;

    if (action === 'decompose') return this.#decomposeGoal(goal || input, context);
    if (action === 'consolidate') return this.#consolidateResults(context.workflow || context);
    if (action === 'arbitrate') return this.#arbitrateConflict(context.conflict);
    if (action === 'validate') return this.#validateAction(context.action, context);
    if (action === 'decide') return this.#makeDecision(input, context);
    if (action === 'summarize') return this.#summarize(context);

    return this.#executeGoal(input, context);
  }

  #parseInput(input) {
    const lower = input.toLowerCase();
    if (lower.startsWith('decompose ') || lower.startsWith('plan ')) return { action: 'decompose', goal: input.replace(/^(decompose|plan)\s+/i, '') };
    if (lower.startsWith('consolidate')) return { action: 'consolidate' };
    if (lower.startsWith('arbitrate')) return { action: 'arbitrate', conflict: input.replace(/^arbitrate\s+/i, '') };
    if (lower.startsWith('validate')) return { action: 'validate' };
    if (lower.startsWith('decide ')) return { action: 'decide', task: input.replace(/^decide\s+/i, '') };
    if (lower.startsWith('summarize') || lower.startsWith('brief')) return { action: 'summarize' };
    return { action: 'execute', goal: input };
  }

  async #decomposeGoal(goal, context) {
    log.info(`[EXEC] decomposing: ${goal.slice(0, 80)}`);

    const reasoning = await this.reason({
      text: `Décompose cet objectif en étapes exécutables: "${goal}". Pour chaque étape, précise l'agent responsable (executive, research, communication, learning) et le type d'action.`,
      rules: ['decomposition', 'planning'],
    }, { depth: 2 });

    const steps = this.#extractStepsFromReasoning(reasoning, goal);
    const risks = await this.predict(goal, { context });

    const plan = {
      goal,
      steps,
      risks: risks?.scenarios || [],
      confidence: reasoning.trace?.confidence || 0.7,
      requiresApproval: steps.some(s => this.needsApproval(s.action)),
      workflowId: context.workflowId,
    };

    this.activeWorkflows.set(context.workflowId || goal, plan);
    await api.act({ type: 'create_concept', name: `plan:${goal.slice(0, 40)}`, type: 'plan' });
    this.emit('executive:decomposed', { goal, steps: steps.length });

    return plan;
  }

  #extractStepsFromReasoning(reasoning, goal) {
    const steps = [];
    const text = typeof reasoning.trace?.conclusion === 'string' ? reasoning.trace.conclusion :
                 typeof reasoning.trace?.conclusion === 'object' ? JSON.stringify(reasoning.trace.conclusion) : '';

    const lines = text.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const clean = line.replace(/^[\d\-*. ]+/, '').trim();
      if (!clean || clean.length < 5) continue;

      const agent = this.#detectAgent(clean);
      steps.push({
        agent,
        task: clean,
        action: this.#detectAction(clean),
        priority: steps.length === 0 ? 1 : 2,
        status: 'pending',
      });
    }

    if (steps.length === 0) {
      steps.push(
        { agent: 'research', task: `Rechercher le contexte de: ${goal}`, action: 'research', priority: 1, status: 'pending' },
        { agent: 'communication', task: `Analyser les conversations liées à: ${goal}`, action: 'analyze', priority: 2, status: 'pending' },
        { agent: 'learning', task: `Observer les résultats pour: ${goal}`, action: 'learn', priority: 3, status: 'pending' },
      );
    }

    return steps;
  }

  #detectAgent(task) {
    const lower = task.toLowerCase();
    if (lower.includes('recherch') || lower.includes('trouv') || lower.includes('cherch') || lower.includes('context')) return 'research';
    if (lower.includes('message') || lower.includes('envoi') || lower.includes('répond') || lower.includes('group') || lower.includes('convers')) return 'communication';
    if (lower.includes('apprend') || lower.includes('observ') || lower.includes('analyse') || lower.includes('évalu')) return 'learning';
    return 'research';
  }

  #detectAction(task) {
    const lower = task.toLowerCase();
    if (lower.includes('crée') || lower.includes('créer') || lower.includes('plan') || lower.includes('mission')) return 'create_mission';
    if (lower.includes('recherch') || lower.includes('trouv')) return 'research';
    if (lower.includes('envoi') || lower.includes('répond')) return 'send_message';
    if (lower.includes('apprend') || lower.includes('observ')) return 'learn';
    if (lower.includes('analys')) return 'analyze';
    return 'execute';
  }

  async #consolidateResults(workflow) {
    if (!workflow || !workflow.steps) return { error: 'no workflow' };
    log.info(`[EXEC] consolidating ${workflow.id}`);

    const results = workflow.steps.map(s => ({
      agent: s.agent,
      task: s.task,
      status: s.status,
      resultSummary: s.result ? (s.result.summary || s.result.conclusion || JSON.stringify(s.result).slice(0, 200)) : null,
    }));

    const summary = await this.reason({
      text: `Consolide ces résultats de workflow:\n${JSON.stringify(results, null, 2)}\n\nGoal: ${workflow.goal}\nProduis un résumé exécutif des accomplissements et prochaines actions.`,
      rules: ['consolidation', 'summary'],
    }, { depth: 1 });

    const consolidated = {
      workflowId: workflow.id,
      goal: workflow.goal,
      stepsCompleted: workflow.steps.filter(s => s.status === 'done').length,
      totalSteps: workflow.steps.length,
      summary: summary.trace?.conclusion || 'Workflow completed',
      decisions: this.decisions.slice(-5),
      timestamp: Date.now(),
    };

    await api.act({ type: 'store_context', key: `workflow:${workflow.id}`, value: consolidated });
    bus.emit('executive:consolidated', { workflowId: workflow.id });
    return consolidated;
  }

  async #arbitrateConflict(conflict) {
    log.info(`[EXEC] arbitrating: ${typeof conflict === 'string' ? conflict.slice(0, 80) : 'object'}`);
    this.conflictLog.push({ conflict, ts: Date.now(), status: 'arbitrating' });

    const resolution = await this.reason({
      text: `Conflit à arbitrer: ${typeof conflict === 'string' ? conflict : JSON.stringify(conflict)}\nPropose une résolution équilibrée en justifiant chaque décision.`,
      rules: ['arbitration', 'fairness'],
    }, { depth: 2 });

    this.conflictLog[this.conflictLog.length - 1].resolution = resolution;
    this.conflictLog[this.conflictLog.length - 1].status = 'resolved';

    this.emit('executive:arbitrated', { conflict, resolution: resolution.trace?.conclusion });
    return { conflict, resolution: resolution.trace?.conclusion || 'no resolution', trace: resolution.trace };
  }

  async #validateAction(action, context) {
    log.info(`[EXEC] validating ${action.type || action}`);
    if (!this.needsApproval(action)) return { valid: true, requiresUser: false };

    const reasoning = await this.reason({
      text: `Valide cette action critique:\nAction: ${JSON.stringify(action)}\nContexte: ${JSON.stringify(context)}\n\nJustifie pourquoi cette action nécessite une validation humaine.`,
      rules: ['validation', 'security'],
    }, { depth: 1 });

    return {
      valid: true,
      requiresUser: true,
      reason: reasoning.trace?.conclusion || 'Action requires approval',
      action,
      timestamp: Date.now(),
    };
  }

  async #makeDecision(input, context) {
    log.info(`[EXEC] deciding: ${typeof input === 'object' ? JSON.stringify(input).slice(0, 100) : input}`);

    const decision = await this.reason({
      text: typeof input === 'object' ? JSON.stringify(input) : input,
      rules: ['decision', 'impact_analysis'],
    }, { depth: 2 });

    const result = {
      id: `dec_${Date.now()}`,
      input,
      decision: decision.trace?.conclusion || 'Analyze completed',
      confidence: decision.trace?.confidence || 0.5,
      alternatives: decision.trace?.alternatives || [],
      context,
      timestamp: Date.now(),
    };

    this.decisions.push(result);
    if (this.decisions.length > 100) this.decisions.shift();

    await api.act({ type: 'store_context', key: `decision:${result.id}`, value: result });
    this.emit('executive:decided', { id: result.id });
    return result;
  }

  async #summarize(context) {
    const summary = {
      activeWorkflows: this.activeWorkflows.size,
      decisions: this.decisions.length,
      conflicts: this.conflictLog.length,
      recentDecisions: this.decisions.slice(-3).map(d => ({
        id: d.id, decision: typeof d.decision === 'string' ? d.decision.slice(0, 100) : 'complex', confidence: d.confidence,
      })),
      recentWorkflows: Array.from(this.activeWorkflows.values()).slice(-3).map(w => ({
        goal: w.goal?.slice(0, 60), steps: w.steps?.length, confidence: w.confidence,
      })),
    };

    return summary;
  }

  async #executeGoal(input, context) {
    const plan = await this.#decomposeGoal(
      typeof input === 'string' ? input : input.goal || input.task || JSON.stringify(input),
      context,
    );
    return plan;
  }

  #onWorkflowDone(data) {
    this.activeWorkflows.delete(data.workflowId);
  }

  #onAgentError(data) {
    log.warn(`[EXEC] agent error: ${data.agent} - ${data.error}`);
  }
}

export const executive = new ExecutiveAgent();
export default executive;
