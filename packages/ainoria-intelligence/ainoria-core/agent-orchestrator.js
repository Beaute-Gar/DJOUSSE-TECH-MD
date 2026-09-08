import { createLogger } from '../../infrastructure/logger.js';
import { permissionsEngine } from './permissions-engine.js';
import { toolEngine } from './tool-engine.js';
import { reasoningEngine } from './reasoning-engine.js';
import { memoryEngine } from './memory-engine.js';
import { planningEngine } from './planning-engine.js';
import { rawGet, rawRun, rawAll } from '../../infrastructure/database/database.js';

const log = createLogger('AGENT-ORCH');

class Agent {
  constructor(config) {
    this.name = config.name;
    this.description = config.description || '';
    this.scope = config.scope || 'general';
    this.permissions = config.permissions || [];
    this.personality = config.personality || 'Professionnel et efficace';
    this.model = config.model || null;
    this.state = 'idle';
    this.executions = 0;
    this.lastActive = null;
    this.errorCount = 0;
    this.customInstructions = config.customInstructions || '';
  }

  async init() {
    for (const perm of this.permissions) {
      permissionsEngine.grant(this.name, perm);
    }
    log.info(`Agent ${this.name} initialisé (${this.permissions.length} permissions)`);
  }

  async handle(input, context = {}) {
    this.state = 'active';
    this.executions++;
    this.lastActive = Date.now();

    try {
      const result = await reasoningEngine.process(input, { ...context, agentName: this.name });
      this.state = 'idle';
      return result;
    } catch (err) {
      this.errorCount++;
      this.state = 'error';
      log.error(`[${this.name}] ${err.message}`);
      return { type: 'error', message: err.message };
    }
  }

  toJSON() {
    return {
      name: this.name,
      description: this.description,
      scope: this.scope,
      state: this.state,
      executions: this.executions,
      lastActive: this.lastActive,
      errorCount: this.errorCount,
      permissions: this.permissions.length,
    };
  }
}

export class AgentOrchestrator {
  constructor() {
    this.agents = new Map();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    await permissionsEngine.init();

    this._registerDefaultAgents();
    this.initialized = true;
    log.info('Agent Orchestrator initialisé avec 4 agents par défaut');
  }

  _registerDefaultAgents() {
    this.registerAgent({
      name: 'agent_whatsapp',
      description: 'Gère les interactions WhatsApp : envoi, réception, programmation, résumé',
      scope: 'whatsapp',
      permissions: ['envoyer_message', 'envoyer_media', 'lire_conversations', 'acceder_groupes',
        'modifier_message', 'supprimer_message', 'programmer_envoi', 'rechercher', 'analyser', 'creer_automatisation'],
      personality: 'Assistant WhatsApp efficace et réactif',
      customInstructions: 'Tu es un assistant WhatsApp. Tu peux envoyer des messages, programmer des envois, rechercher dans l\'historique, résumer des conversations et créer des automatisations. Sois concis et va droit au but.',
    });

    this.registerAgent({
      name: 'agent_calendrier',
      description: 'Gère l\'agenda, les rappels et la planification',
      scope: 'calendar',
      permissions: ['programmer_envoi', 'gerer_agenda', 'lire_conversations'],
      personality: 'Organisé et précis',
      customInstructions: 'Tu gères l\'agenda et les rappels. Tu peux programmer des messages, créer des événements et gérer le temps.',
    });

    this.registerAgent({
      name: 'agent_securite',
      description: 'Surveille la sécurité, les permissions et les accès',
      scope: 'security',
      permissions: ['lire_conversations', 'gerer_securite'],
      personality: 'Vigilant et méthodique',
      customInstructions: 'Tu es responsable de la sécurité. Tu surveilles les accès, vérifies les permissions et alertes en cas d\'activité suspecte.',
    });

    this.registerAgent({
      name: 'agent_documents',
      description: 'Gère les fichiers, documents et la connaissance',
      scope: 'documents',
      permissions: ['acceder_fichiers', 'rechercher', 'analyser'],
      personality: 'Documentaliste rigoureux',
      customInstructions: 'Tu gères les documents et la connaissance. Tu peux rechercher dans les fichiers, analyser des documents et organiser l\'information.',
    });
  }

  registerAgent(config) {
    if (this.agents.has(config.name)) {
      log.warn(`Agent ${config.name} déjà enregistré`);
      return this.agents.get(config.name);
    }
    const agent = new Agent(config);
    agent.init().catch(err => log.error(`Init ${config.name}: ${err.message}`));
    this.agents.set(config.name, agent);
    return agent;
  }

  getAgent(name) {
    return this.agents.get(name) || null;
  }

  async route(input, context = {}) {
    const agentName = context.agentName || this._detectAgent(input, context);
    const agent = this.agents.get(agentName);
    if (!agent) {
      log.warn(`Agent ${agentName} introuvable, routage vers agent_whatsapp`);
      return this.agents.get('agent_whatsapp')?.handle(input, context) || reasoningEngine.process(input, context);
    }
    return agent.handle(input, context);
  }

  _detectAgent(input, context = {}) {
    const text = typeof input === 'string' ? input.toLowerCase() : '';

    if (context.scope === 'security' || text.includes('sécurité') || text.includes('permission') || text.includes('alerte')) {
      return 'agent_securite';
    }
    if (text.includes('document') || text.includes('fichier') || text.includes('pdf') || text.includes('image')) {
      return 'agent_documents';
    }
    if (text.includes('rappeler') || text.includes('agenda') || text.includes('calendrier') || text.includes('programme') || text.includes('rendez-vous')) {
      return 'agent_calendrier';
    }
    return 'agent_whatsapp';
  }

  list() {
    return Array.from(this.agents.values()).map(a => a.toJSON());
  }

  getStats() {
    const agents = this.list();
    return {
      total: agents.length,
      active: agents.filter(a => a.state === 'active').length,
      idle: agents.filter(a => a.state === 'idle').length,
      error: agents.filter(a => a.state === 'error').length,
      totalExecutions: agents.reduce((s, a) => s + a.executions, 0),
      agents,
    };
  }
}

export const agentOrchestrator = new AgentOrchestrator();
export default agentOrchestrator;
