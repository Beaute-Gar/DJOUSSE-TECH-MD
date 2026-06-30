import { CognitiveAgent } from './agent-framework.js';
import { createLogger } from '../../core/logger.js';
import { api } from '../cognitive-api.js';
import { bus, EVENTS } from '../event-bus.js';
import { semanticMemory } from '../semantic-memory.js';

const log = createLogger('COMM');

export class CommunicationAgent extends CognitiveAgent {
  constructor() {
    super('communication', {
      canObserve: true,
      canReason: true,
      canPlan: false,
      canPredict: true,
      canRemember: true,
      canSearch: true,
      canAct: true,
      canCommunicate: true,
      requiresApproval: ['send_message', 'broadcast', 'delete', 'approve_user'],
      consumesAIBudget: 2,
    });
    this.conversationContext = new Map();
    this.drafts = new Map();
    this.stats = { messagesAnalyzed: 0, draftsPrepared: 0, assistsProvided: 0 };

    bus.on(EVENTS.MESSAGE_RECEIVED, this.#onMessage.bind(this));
  }

  async process(input, context = {}) {
    log.info(`[COMM] processing: ${typeof input === 'string' ? input.slice(0, 80) : 'object'}`);

    const { action, task, content, target } = typeof input === 'string'
      ? this.#parseInput(input) : input;

    switch (action) {
      case 'analyze':       return this.#analyzeConversation(content || task, context);
      case 'respond':       return this.#prepareResponse(content || task, context);
      case 'draft':         return this.#draftMessage(content || task, context);
      case 'summarize':     return this.#summarizeConversation(target || context.jid, context);
      case 'sentiment':     return this.#analyzeSentiment(content || task, context);
      case 'extract':       return this.#extractIntent(content || task, context);
      case 'group':         return this.#analyzeGroup(target || task, context);
      case 'suggest':       return this.#suggestResponse(content || task, context);
      default:              return this.#analyzeConversation(input, context);
    }
  }

  #parseInput(input) {
    const lower = input.toLowerCase();
    if (lower.startsWith('analyze ') || lower.startsWith('analyse ')) return { action: 'analyze', task: input.replace(/^(analyze|analyse)\s+/i, '') };
    if (lower.startsWith('respond ') || lower.startsWith('reply ')) return { action: 'respond', task: input.replace(/^(respond|reply)\s+/i, '') };
    if (lower.startsWith('draft ')) return { action: 'draft', task: input.replace(/^draft\s+/i, '') };
    if (lower.startsWith('summarize ')) return { action: 'summarize', target: input.replace(/^summarize\s+/i, '') };
    if (lower.startsWith('sentiment ')) return { action: 'sentiment', content: input.replace(/^sentiment\s+/i, '') };
    if (lower.startsWith('extract ')) return { action: 'extract', content: input.replace(/^extract\s+/i, '') };
    if (lower.startsWith('group ')) return { action: 'group', target: input.replace(/^group\s+/i, '') };
    if (lower.startsWith('suggest ')) return { action: 'suggest', content: input.replace(/^suggest\s+/i, '') };
    return { action: 'analyze', task: input };
  }

  async #onMessage(data) {
    this.stats.messagesAnalyzed++;
    const { key, message, jid, author } = data;
    if (!message?.conversation && !message?.extendedTextMessage) return;

    const text = message.conversation || message.extendedTextMessage?.text || '';
    if (!text || text.length < 3) return;

    const ctx = await this.#analyzeConversation(text, { jid, author });
    this.conversationContext.set(`${jid}_${Date.now()}`, ctx);

    bus.emit('communication:analyzed', {
      jid, author, text: text.slice(0, 100), intent: ctx.intent, urgency: ctx.urgency,
    });
  }

  async #analyzeConversation(content, context) {
    if (!content) return { error: 'no content' };

    const observed = await this.observe(content, { jid: context.jid });
    const reasoning = await this.reason({
      text: `Analyse ce message:\n"${content}"\n\nIdentifie: intention, urgence (1-5), sentiment, sujets clés, et actions suggérées.`,
      rules: ['conversation_analysis', 'intent_detection'],
    }, { depth: 2 });

    const analysis = {
      content: observed?.summary || content,
      intent: this.#detectIntent(reasoning),
      urgency: this.#extractUrgency(reasoning),
      sentiment: this.#extractSentiment(reasoning),
      topics: this.#extractTopics(reasoning, content),
      suggestedActions: this.#extractActions(reasoning),
      reasoning: reasoning.trace,
      confidence: observed?.confidence || 0.6,
      timestamp: Date.now(),
    };

    return analysis;
  }

  #detectIntent(reasoning) {
    const conclusion = typeof reasoning.trace?.conclusion === 'string' ? reasoning.trace.conclusion.toLowerCase() : '';
    if (conclusion.includes('question') || conclusion.includes('demande')) return 'question';
    if (conclusion.includes('commande') || conclusion.includes('order')) return 'order';
    if (conclusion.includes('problème') || conclusion.includes('issue') || conclusion.includes('erreur')) return 'problem';
    if (conclusion.includes('suggestion') || conclusion.includes('idée') || conclusion.includes('propos')) return 'suggestion';
    if (conclusion.includes('salut') || conclusion.includes('bonjour') || conclusion.includes('hey')) return 'greeting';
    if (conclusion.includes('au revoir') || conclusion.includes('bye')) return 'farewell';
    return 'general';
  }

  #extractUrgency(reasoning) {
    const conclusion = typeof reasoning.trace?.conclusion === 'string' ? reasoning.trace.conclusion.toLowerCase() : '';
    if (conclusion.includes('urgent') || conclusion.includes('critical')) return 5;
    if (conclusion.includes('important')) return 4;
    if (conclusion.includes('attention')) return 3;
    if (conclusion.includes('préoccupation') || conclusion.includes('suivi')) return 2;
    return 1;
  }

  #extractSentiment(reasoning) {
    const conclusion = typeof reasoning.trace?.conclusion === 'string' ? reasoning.trace.conclusion.toLowerCase() : '';
    if (conclusion.includes('positif') || conclusion.includes('content') || conclusion.includes('satisfait')) return 'positive';
    if (conclusion.includes('négatif') || conclusion.includes('frustré') || conclusion.includes('mécontent')) return 'negative';
    if (conclusion.includes('neutre')) return 'neutral';
    if (conclusion.includes('urgent') || conclusion.includes('stress')) return 'urgent';
    return 'neutral';
  }

  #extractTopics(reasoning, content) {
    const topics = [];
    const words = content.split(/\s+/).filter(w => w.length > 4);
    const seen = new Set();
    for (const word of words) {
      const clean = word.replace(/[^a-zA-ZÀ-ÿ0-9]/g, '');
      if (clean.length > 4 && !seen.has(clean.toLowerCase())) {
        topics.push(clean.toLowerCase());
        seen.add(clean.toLowerCase());
      }
    }
    return topics.slice(0, 5);
  }

  #extractActions(reasoning) {
    const actions = [];
    const conclusion = typeof reasoning.trace?.conclusion === 'string' ? reasoning.trace.conclusion : '';
    if (conclusion.includes('répondre') || conclusion.includes('respond')) actions.push('respond');
    if (conclusion.includes('créer')) actions.push('create');
    if (conclusion.includes('recherche')) actions.push('research');
    if (conclusion.includes('planifier') || conclusion.includes('plan')) actions.push('plan');
    if (actions.length === 0) actions.push('acknowledge');
    return actions;
  }

  async #prepareResponse(content, context) {
    const analysis = await this.#analyzeConversation(content, context);
    const reasoning = await this.reason({
      text: `Contexte: message="${content}"\nAnalyse: ${JSON.stringify(analysis)}\n\nPrépare une réponse appropriée en fonction de l'intention et du sentiment. Propose 2-3 options si pertinent.`,
      rules: ['response_preparation', 'tone_matching'],
    }, { depth: 1 });

    const draft = {
      originalContent: content,
      analysis,
      suggestedResponse: reasoning.trace?.conclusion || 'Acknowledged.',
      options: reasoning.trace?.options || [],
      requiresApproval: this.needsApproval('send_message'),
      timestamp: Date.now(),
    };

    this.drafts.set(Date.now().toString(), draft);
    this.stats.draftsPrepared++;
    return draft;
  }

  async #draftMessage(content, context) {
    const reasoning = await this.reason({
      text: `Rédige un message professionnel à partir de ces instructions: "${content}".\nContexte: ${JSON.stringify(context)}`,
      rules: ['writing', 'professional_tone'],
    }, { depth: 1 });

    const draft = {
      content: reasoning.trace?.conclusion || content,
      instructions: content,
      requiresApproval: true,
      characterCount: (reasoning.trace?.conclusion || content).length,
      timestamp: Date.now(),
    };

    this.drafts.set(Date.now().toString(), draft);
    this.stats.draftsPrepared++;
    return draft;
  }

  async #summarizeConversation(jid, context) {
    const memory = await api.remember('', { jid, limit: 30 });
    const episodes = await semanticMemory.timeline?.search?.(jid || '') || [];
    const jidContext = semanticMemory.context?.getAll?.(jid) || {};

    const reasoning = await this.reason({
      text: `Résume la conversation avec ce contact:\nMessages récents: ${(memory.semantic || []).slice(0, 5).join('\n')}\nÉpisodes: ${JSON.stringify(episodes.slice(0, 3))}\nContexte: ${JSON.stringify(jidContext).slice(0, 300)}`,
      rules: ['summarization', 'conversation_analysis'],
    }, { depth: 1 });

    return {
      jid,
      summary: reasoning.trace?.conclusion || 'No conversation history',
      messageCount: memory.semantic?.length || 0,
      episodesCount: episodes.length,
      keyTopics: this.#extractTopics(reasoning, JSON.stringify(jidContext)),
    };
  }

  async #analyzeSentiment(content, context) {
    if (!content) return { error: 'no content' };

    const reasoning = await this.reason({
      text: `Analyse le sentiment de ce message:\n"${content}"\n\nScore de -1 (très négatif) à +1 (très positif). Justifie.`,
      rules: ['sentiment_analysis', 'emotion_detection'],
    }, { depth: 1 });

    return {
      content,
      sentiment: this.#extractSentiment(reasoning),
      score: reasoning.trace?.confidence || 0,
      analysis: reasoning.trace?.conclusion || 'Analyzed',
    };
  }

  async #extractIntent(content, context) {
    const analysis = await this.#analyzeConversation(content, context);
    return {
      content,
      intent: analysis.intent,
      confidence: analysis.confidence,
      topics: analysis.topics,
      suggestedActions: analysis.suggestedActions,
    };
  }

  async #analyzeGroup(target, context) {
    const groupContext = semanticMemory.context?.getAll?.(target) || {};
    const members = Object.keys(groupContext).filter(k => k.includes('@s.whatsapp.net'));

    const reasoning = await this.reason({
      text: `Analyse ce groupe: ${target}\nContexte: ${JSON.stringify(groupContext).slice(0, 300)}\nMembres: ${members.length}\n\nDonne un résumé de la dynamique du groupe.`,
      rules: ['group_analysis', 'social_dynamics'],
    }, { depth: 1 });

    return {
      jid: target,
      memberCount: members.length,
      summary: reasoning.trace?.conclusion || 'Group analyzed',
      contextKeys: Object.keys(groupContext).slice(0, 10),
    };
  }

  async #suggestResponse(content, context) {
    const prepared = await this.#prepareResponse(content, context);
    return {
      originalContent: content,
      suggestions: prepared.options?.length ? prepared.options : [prepared.suggestedResponse],
      intent: prepared.analysis?.intent,
      requiresApproval: prepared.requiresApproval,
    };
  }

  getDraft(id) {
    return this.drafts.get(id);
  }

  getAllDrafts() {
    return Array.from(this.drafts.values());
  }

  getStats() {
    return { ...this.stats, activeContexts: this.conversationContext.size };
  }
}

export const communication = new CommunicationAgent();
export default communication;
