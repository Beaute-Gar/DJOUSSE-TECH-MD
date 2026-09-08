import { createLogger } from '../../infrastructure/logger.js';
import { aiRouter } from './ai-router.js';
import { memoryEngine } from './memory-engine.js';
import { planningEngine } from './planning-engine.js';
import { toolEngine } from './tool-engine.js';
import { permissionsEngine } from './permissions-engine.js';
import { contextEngine } from './context-engine.js';

const log = createLogger('REASON-CORE');

export class ReasoningEngine {
  constructor() {
    this.conversationHistory = new Map();
    this.maxHistoryPerJid = 50;
    this.stats = { totalRequests: 0, withPlan: 0, direct: 0 };
  }

  async process(input, context = {}) {
    this.stats.totalRequests++;
    const jid = context.jid || context.senderJid || 'unknown';
    const startTime = Date.now();

    if (!this.conversationHistory.has(jid)) {
      this.conversationHistory.set(jid, []);
    }
    const history = this.conversationHistory.get(jid);

    history.push({ role: 'user', content: typeof input === 'string' ? input : JSON.stringify(input), timestamp: Date.now() });
    if (history.length > this.maxHistoryPerJid) history.splice(0, history.length - this.maxHistoryPerJid);

    try {
      const enrichedContext = await contextEngine.enrich(input, { jid, ...context });

      const intent = await this._analyzeIntent(input, enrichedContext);

      if (intent.needsConfirmation) {
        return {
          type: 'confirmation_required',
          message: intent.confirmationMessage,
          intent: intent.type,
          confidence: intent.confidence,
          data: intent,
        };
      }

      if (intent.type === 'planification' || intent.type === 'mission') {
        this.stats.withPlan++;
        const plan = await planningEngine.createPlan(input, { jid, ...context });
        const planResult = await planningEngine.executePlan(plan.id, { jid, ...context });
        const response = await this._synthesizeResponse(planResult, input, enrichedContext);
        return { type: 'plan_executed', response, plan: planResult, intent: intent.type };
      }

      if (intent.type === 'outil') {
        const toolName = intent.tool;
        const toolParams = intent.toolParams || {};

        const permCheck = await permissionsEngine.require(context.agentName || 'reasoning', intent.permission || toolName, context);
        if (permCheck !== true) {
          return { type: 'permission_denied', message: typeof permCheck === 'object' ? permCheck.message : 'Permission refusée', tool: toolName };
        }

        const memories = await memoryEngine.recallVectorial(jid, input, 5);
        const enrichedParams = { ...toolParams, jid, memories };

        const toolResult = await toolEngine.execute(toolName, enrichedParams, { agentName: 'reasoning', jid, ...context });
        return { type: 'tool_executed', response: toolResult.result, tool: toolName };
      }

      this.stats.direct++;
      const memories = await memoryEngine.recallVectorial(jid, input, 5);

      const memoryBlock = memories.length > 0
        ? 'Contexte memoire:\n' + memories.map(m => `[${m.type}] ${m.content.slice(0, 300)}`).join('\n')
        : '';

      const historyBlock = history.slice(-10).map(m => `${m.role}: ${typeof m.content === 'string' ? m.content.slice(0, 200) : '[objet]'}`).join('\n');

      const systemPrompt = `Tu es AINORIA, assistant IA intégré à WhatsApp.
Réponds en français, de façon naturelle et concise.
Utilise les informations de contexte et de mémoire pour personnaliser ta réponse.
Si une action est demandée, indique clairement ce que tu as fait ou ce que tu proposes de faire.`;

      const fullPrompt = [
        memoryBlock,
        enrichedContext.summary ? `Contexte enrichi: ${enrichedContext.summary}` : '',
        `Conversation récente:\n${historyBlock}`,
        `\nMessage: ${input}`,
      ].filter(Boolean).join('\n\n');

      const response = await aiRouter.query('conversation', systemPrompt,
        [{ role: 'user', content: fullPrompt }],
        { maxTokens: 1024 }
      );

      history.push({ role: 'assistant', content: response.text, timestamp: Date.now() });

      await memoryEngine.storeLongTerm(jid, 'conversation',
        `Q: ${input.slice(0, 500)}\nR: ${response.text.slice(0, 500)}`
      );

      const duration = Date.now() - startTime;
      return { type: 'response', response: response.text, provider: response.provider, duration };
    } catch (err) {
      log.error(`[REASON] ${err.message}`);
      return {
        type: 'error',
        message: 'Désolé, je n\'ai pas pu traiter ta demande.',
        error: err.message,
      };
    }
  }

  async _analyzeIntent(input, context = {}) {
    const systemPrompt = `Tu es un analyseur d'intention. Analyse le message et réponds UNIQUEMENT avec un JSON :

Types d'intention:
- "conversation": discussion générale, question, salutation
- "outil": demande d'action spécifique (envoyer message, programmer, rechercher, résumer)
- "planification": objectif complexe qui nécessite plusieurs étapes
- "question_connaissance": demande d'information sur un sujet
- "analyse": demande d'analyse ou de résumé

Si "outil", précise tool (nom exact: envoyer_message, programmer_message, rechercher_message, resumer_conversation, obtenir_contacts, obtenir_groupes, info_conversation, creer_automatisation) et toolParams (objet).
Si l'action nécessite une confirmation humaine, mets needsConfirmation: true avec confirmationMessage expliquant pourquoi.

Format: { "type": "str", "confidence": 0.0-1.0, "tool": "str|null", "toolParams": {}, "needsConfirmation": false, "confirmationMessage": "str|null", "permission": "str|null" }`;

    try {
      const result = await aiRouter.query('analyse', systemPrompt,
        [{ role: 'user', content: typeof input === 'string' ? input.slice(0, 2000) : JSON.stringify(input) }],
        { temperature: 0.1, maxTokens: 1024 }
      );
      const parsed = JSON.parse(result.text);
      return {
        type: parsed.type || 'conversation',
        confidence: parsed.confidence || 0.5,
        tool: parsed.tool || null,
        toolParams: parsed.toolParams || {},
        needsConfirmation: parsed.needsConfirmation || false,
        confirmationMessage: parsed.confirmationMessage || null,
        permission: parsed.permission || null,
      };
    } catch {
      return { type: 'conversation', confidence: 0.5, tool: null, toolParams: {}, needsConfirmation: false, confirmationMessage: null, permission: null };
    }
  }

  async _synthesizeResponse(planResult, originalInput, context) {
    const systemPrompt = 'Résume le résultat du plan exécuté en français, de façon claire et concise. Dis ce qui a été fait et le résultat.';
    const input = `Objectif: ${originalInput}\nRésultat: ${JSON.stringify(planResult)}`;
    const response = await aiRouter.query('resume', systemPrompt, [{ role: 'user', content: input }], { maxTokens: 512 });
    return response.text;
  }

  getConversationHistory(jid, limit = 20) {
    const history = this.conversationHistory.get(jid);
    return history ? history.slice(-limit) : [];
  }

  getStats() {
    return { ...this.stats, activeConversations: this.conversationHistory.size };
  }
}

export const reasoningEngine = new ReasoningEngine();
export default reasoningEngine;
