import { createLogger } from '../../infrastructure/logger.js';
import { aiRouter } from './ai-router.js';
import { toolEngine } from './tool-engine.js';
import { rawGet, rawRun, rawAll } from '../../infrastructure/database/database.js';

const log = createLogger('PLAN-CORE');

export class PlanningEngine {
  constructor() {
    this.activePlans = new Map();
    this.stats = { total: 0, completed: 0, failed: 0 };
  }

  async createPlan(goal, context = {}) {
    log.info(`[PLAN] Nouveau plan: ${goal.slice(0, 100)}`);

    const decomposition = await aiRouter.query('planification',
      'Tu es un planificateur. Décompose l\'objectif suivant en étapes concrètes et séquentielles. ' +
      'Réponds UNIQUEMENT avec un JSON valide : un tableau d\'objets { "step": number, "action": string, "tool": string|null, "params": object, "expected": string }. ' +
      'Chaque outil doit être un nom d\'outil réel (envoyer_message, resumer_conversation, rechercher_message, etc.). Si aucune tool n\'est pertinente, mets null.',
      [{ role: 'user', content: goal }],
      { temperature: 0.2, maxTokens: 2048 }
    );

    let steps = [];
    try {
      steps = JSON.parse(decomposition.text);
      if (!Array.isArray(steps)) throw new Error('Pas un tableau');
    } catch {
      log.warn(`[PLAN] JSON invalide, fallback: ${decomposition.text.slice(0, 200)}`);
      steps = [{ step: 1, action: goal, tool: null, params: {}, expected: 'Objectif atteint' }];
    }

    const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const plan = {
      id: planId,
      goal,
      steps: steps.map((s, i) => ({
        ...s,
        status: 'pending',
        result: null,
        error: null,
        startedAt: null,
        completedAt: null,
      })),
      status: 'active',
      context,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      currentStep: 0,
    };

    this.activePlans.set(planId, plan);
    this.stats.total++;

    try {
      const stepsJson = JSON.stringify(steps.map(s => ({ step: s.step, action: s.action, tool: s.tool })));
      rawRun('INSERT INTO ainoria_plans (id, goal, steps, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        planId, goal.slice(0, 2000), stepsJson, 'active', Date.now(), Date.now());
    } catch (dbErr) {
      log.warn(`[PLAN] DB save: ${dbErr.message}`);
    }

    return plan;
  }

  async executePlan(planId, context = {}) {
    const plan = this.activePlans.get(planId);
    if (!plan) throw new Error(`Plan ${planId} introuvable`);
    if (plan.status !== 'active') throw new Error(`Plan ${planId} est ${plan.status}`);

    const mergedCtx = { ...plan.context, ...context };
    const results = [];

    for (let i = plan.currentStep; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      step.status = 'in_progress';
      step.startedAt = Date.now();
      plan.currentStep = i;
      plan.updatedAt = Date.now();

      log.info(`[PLAN] Étape ${i + 1}/${plan.steps.length}: ${step.action.slice(0, 100)}`);

      try {
        if (step.tool && toolEngine.getTool(step.tool)) {
          const toolResult = await toolEngine.execute(step.tool, step.params || {}, mergedCtx);
          step.result = typeof toolResult.result === 'string' ? toolResult.result : JSON.stringify(toolResult.result);
        } else {
          step.result = `Action exécutée: ${step.action}`;
        }
        step.status = 'completed';
        step.completedAt = Date.now();
        results.push({ step: step.step, success: true, result: step.result });
      } catch (err) {
        step.status = 'failed';
        step.error = err.message;
        plan.status = 'failed';
        plan.updatedAt = Date.now();
        this.stats.failed++;
        results.push({ step: step.step, success: false, error: err.message });

        rawRun('UPDATE ainoria_plans SET status = ?, steps = ?, updated_at = ? WHERE id = ?',
          'failed', JSON.stringify(plan.steps.map(s => ({ step: s.step, status: s.status, action: s.action, error: s.error }))), Date.now(), planId);

        return { planId, goal: plan.goal, status: 'failed', failedStep: step, results };
      }
    }

    plan.status = 'completed';
    plan.updatedAt = Date.now();
    this.stats.completed++;

    rawRun('UPDATE ainoria_plans SET status = ?, steps = ?, updated_at = ? WHERE id = ?',
      'completed', JSON.stringify(plan.steps.map(s => ({ step: s.step, status: s.status, action: s.action }))), Date.now(), planId);

    return { planId, goal: plan.goal, status: 'completed', steps: plan.steps.length, results };
  }

  getPlan(planId) {
    return this.activePlans.get(planId) || null;
  }

  cancelPlan(planId) {
    const plan = this.activePlans.get(planId);
    if (!plan) return false;
    plan.status = 'cancelled';
    plan.updatedAt = Date.now();
    rawRun('UPDATE ainoria_plans SET status = ?, updated_at = ? WHERE id = ?', 'cancelled', Date.now(), planId);
    return true;
  }

  getActivePlans() {
    return Array.from(this.activePlans.values()).filter(p => p.status === 'active');
  }

  getStats() {
    return { ...this.stats, active: this.activePlans.size };
  }
}

export const planningEngine = new PlanningEngine();
export default planningEngine;
