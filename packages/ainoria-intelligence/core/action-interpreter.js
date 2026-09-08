/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  INTERPRÉTEUR D'ACTIONS — Inspiré de CodeAct (Manus)   ║
 * ║  Interprète des intentions complexes en actions         ║
 * ╚══════════════════════════════════════════════════════════╝
 */

export class ActionInterpreter {
  constructor(llmService, whatsappService, vfsService, learningLoop, schedulerService) {
    this.llmService = llmService; // Service pour les appels à Groq ou autre LLM
    this.whatsappService = whatsappService; // Service pour interagir avec WhatsApp (sock)
    this.vfsService = vfsService; // Service de système de fichiers virtuel
    this.learningLoop = learningLoop; // Pour enregistrer les erreurs et apprendre
    this.schedulerService = schedulerService; // Service pour la planification des rappels
  }

  /**
   * Reçoit une intention en langage naturel et la traduit en actions.
   * @param {string} jid - L'ID du groupe WhatsApp.
   * @param {string} intent - L'intention en langage naturel.
   * @param {object} context - Le contexte actuel du groupe (issu du VFS).
   * @returns {Promise<Array<object>>} Les résultats des actions exécutées.
   */
  async interpretIntent(jid, intent, context) {
    const prompt = `Traduis cette intention en une séquence d'actions DJOUSSE TECH.\n\nIntention : "${intent}"\nContexte : Groupe WhatsApp, ${context.membersCount} membres, règles: ${context.rules.substring(0, Math.min(context.rules.length, 100))}...\n\nActions disponibles (avec validation des paramètres):\n- send_message(text: string): Envoyer un message texte au groupe.\n- create_poll(question: string, options: string[]): Créer un sondage avec une question et des options.\n- schedule_message(text: string, date: string): Programmer un message pour une date future (format YYYY-MM-DD HH:MM).\n- set_rule(ruleText: string): Définir ou mettre à jour une règle du groupe.\n- ban_user(userId: string, reason: string): Bannir un utilisateur du groupe.\n- mute_user(userId: string, durationMinutes: number): Mettre un utilisateur en sourdine pour une durée.\n- announce(announcementText: string): Faire une annonce importante au groupe.\n- start_quiz(theme: string): Lancer un quiz sur un thème donné.\n- generate_report(reportType: string): Générer un rapport spécifique (ex: 'activity', 'members').\n\nRéponds en JSON, avec un tableau d'objets 'actions'. Chaque objet doit avoir 'action' et 'params'.\nExemple: { "actions": [ { "action": "send_message", "params": {"text": "Bonjour à tous !"} } ] }`;

    let actionsPlan;
    try {
      const llmResponse = await this.llmService.callGroq(prompt);
      const jsonMatch = llmResponse.match(/```json\n([\s\S]*?)\n```/);
      const rawJson = jsonMatch ? jsonMatch[1] : llmResponse;
      actionsPlan = JSON.parse(rawJson).actions;

      if (!Array.isArray(actionsPlan)) {
        throw new Error("Le LLM n'a pas retourné un tableau d'actions valide.");
      }
    } catch (error) {
      console.error(`Erreur lors de l'interprétation de l'intention pour ${jid}:`, error);
      await this.learningLoop.handleError(jid, error, { intent, context, phase: 'interpretation' });
      return [{ success: false, error: `Impossible d'interpréter l'intention: ${error.message}` }];
    }

    return this.executeActions(jid, actionsPlan);
  }

  /**
   * Exécute une séquence d'actions générées par l'IA.
   * @param {string} jid - L'ID du groupe WhatsApp.
   * @param {Array<object>} actions - Le tableau d'actions à exécuter.
   * @returns {Promise<Array<object>>} Les résultats de chaque action.
   */
  async executeActions(jid, actions) {
    const results = [];

    for (const step of actions) {
      try {
        // Validation des actions et des paramètres avant exécution
        if (!step.action || typeof this[step.action] !== 'function') {
          throw new Error(`Action inconnue ou non implémentée: ${step.action}`);
        }
        // Appel dynamique de la méthode correspondante
        const actionResult = await this[step.action](jid, step.params);
        results.push({ success: true, action: step.action, result: actionResult });
        await this.learningLoop.logSuccess(jid, step.action, actionResult);
      } catch (error) {
        console.error(`Erreur lors de l'exécution de l'action ${step.action} pour ${jid}:`, error);
        results.push({ success: false, action: step.action, error: error.message });
        await this.learningLoop.handleError(jid, error, { action: step.action, params: step.params, phase: 'execution' });
      }
    }
    return results;
  }

  // --- Implémentations des actions spécifiques --- 
  // Ces méthodes encapsulent la logique d'interaction avec WhatsApp et le VFS

  async send_message(jid, params) {
    if (!params.text || typeof params.text !== 'string') {
      throw new Error('Paramètre `text` manquant ou invalide pour send_message.');
    }
    await this.whatsappService.sendMessage(jid, { text: params.text });
    return `Message envoyé: ${params.text}`;
  }

  async create_poll(jid, params) {
    if (!params.question || typeof params.question !== 'string' || !Array.isArray(params.options) || params.options.length === 0) {
      throw new Error('Paramètres `question` ou `options` manquants/invalides pour create_poll.');
    }
    await this.whatsappService.sendMessage(jid, {
      poll: {
        name: params.question,
        values: params.options,
        selectableCount: 1
      }
    });
    return `Sondage créé: ${params.question}`;
  }

  async schedule_message(jid, params) {
    if (!params.text || typeof params.text !== 'string' || !params.date || typeof params.date !== 'string') {
      throw new Error('Paramètres `text` ou `date` manquants/invalides pour schedule_message.');
    }
    // Validation simple du format de date, une validation plus robuste serait nécessaire
    if (!/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(params.date)) {
      throw new Error('Format de date invalide. Attendu: YYYY-MM-DD HH:MM.');
    }
    await this.schedulerService.scheduleMessage(jid, params.text, params.date);
    return `Message programmé pour le ${params.date}: ${params.text}`;
  }

  async set_rule(jid, params) {
    if (!params.ruleText || typeof params.ruleText !== 'string') {
      throw new Error('Paramètre `ruleText` manquant ou invalide pour set_rule.');
    }
    await this.vfsService.updateRules(jid, params.ruleText);
    return `Règle mise à jour: ${params.ruleText}`;
  }

  async ban_user(jid, params) {
    if (!params.userId || typeof params.userId !== 'string' || !params.reason || typeof params.reason !== 'string') {
      throw new Error('Paramètres `userId` ou `reason` manquants/invalides pour ban_user.');
    }
    // Logique de bannissement d'utilisateur (nécessite des droits admin WhatsApp)
    // await this.whatsappService.banUser(jid, params.userId);
    await this.vfsService.logEvent(jid, `Utilisateur ${params.userId} banni pour: ${params.reason}`);
    return `Utilisateur ${params.userId} banni pour: ${params.reason}`;
  }

  async mute_user(jid, params) {
    if (!params.userId || typeof params.userId !== 'string' || !params.durationMinutes || typeof params.durationMinutes !== 'number') {
      throw new Error('Paramètres `userId` ou `durationMinutes` manquants/invalides pour mute_user.');
    }
    // Logique de mise en sourdine d'utilisateur
    // await this.whatsappService.muteUser(jid, params.userId, params.durationMinutes);
    await this.vfsService.logEvent(jid, `Utilisateur ${params.userId} mis en sourdine pour ${params.durationMinutes} minutes.`);
    return `Utilisateur ${params.userId} mis en sourdine pour ${params.durationMinutes} minutes.`
  }

  async announce(jid, params) {
    if (!params.announcementText || typeof params.announcementText !== 'string') {
      throw new Error('Paramètre `announcementText` manquant ou invalide pour announce.');
    }
    await this.whatsappService.sendMessage(jid, { text: `📢 *ANNONCE IMPORTANTE*\n\n${params.announcementText}` });
    await this.vfsService.logEvent(jid, `Annonce faite: ${params.announcementText}`);
    return `Annonce faite: ${params.announcementText}`;
  }

  async start_quiz(jid, params) {
    if (!params.theme || typeof params.theme !== 'string') {
      throw new Error('Paramètre `theme` manquant ou invalide pour start_quiz.');
    }
    // Logique pour démarrer un quiz
    await this.whatsappService.sendMessage(jid, { text: `🎮 *QUIZ*\n\nUn quiz sur le thème '${params.theme}' va commencer !` });
    await this.vfsService.logEvent(jid, `Quiz démarré sur le thème: ${params.theme}`);
    return `Quiz démarré sur le thème: ${params.theme}`;
  }

  async generate_report(jid, params) {
    if (!params.reportType || typeof params.reportType !== 'string') {
      throw new Error('Paramètre `reportType` manquant ou invalide pour generate_report.');
    }
    // Logique pour générer un rapport (pourrait interagir avec d'autres modules)
    await this.whatsappService.sendMessage(jid, { text: `📊 Génération du rapport de type '${params.reportType}' en cours...` });
    await this.vfsService.logEvent(jid, `Rapport de type '${params.reportType}' généré.`);
    return `Rapport de type '${params.reportType}' généré.`
  }
}

// --- Placeholder pour les services externes ---

class MockLlmService {
  async callGroq(prompt) {
    console.log(`[LLM Mock] Appel Groq avec prompt: ${prompt.substring(0, Math.min(prompt.length, 100))}...`);
    // Simule une réponse JSON valide pour le test
    return JSON.stringify({
      actions: [
        { action: 'send_message', params: { text: 'Bonjour à tous !' } },
        { action: 'create_poll', params: { question: 'Quel est votre sujet préféré ?', options: ['IA', 'Blockchain', 'Cloud'] } },
      ],
    });
  }
}

class MockWhatsappService {
  async sendMessage(jid, content) {
    console.log(`[WhatsApp Mock] Message envoyé à ${jid}:`, content);
  }
  async banUser(jid, userId) {
    console.log(`[WhatsApp Mock] Utilisateur ${userId} banni du groupe ${jid}`);
  }
  async muteUser(jid, userId, durationMinutes) {
    console.log(`[WhatsApp Mock] Utilisateur ${userId} mis en sourdine pour ${durationMinutes} minutes dans le groupe ${jid}`);
  }
}

class MockVfsService {
  async updateRules(jid, ruleText) {
    console.log(`[VFS Mock] Règles du groupe ${jid} mises à jour: ${ruleText}`);
  }
  async logEvent(jid, event) {
    console.log(`[VFS Mock] Événement logué pour le groupe ${jid}: ${event}`);
  }
}

class MockLearningLoop {
  async handleError(jid, error, context) {
    console.error(`[LearningLoop Mock] Erreur enregistrée pour ${jid}: ${error.message}`, context);
  }
  async logSuccess(jid, action, result) {
    console.log(`[LearningLoop Mock] Succès enregistré pour ${jid}, action ${action}:`, result);
  }
}

class MockSchedulerService {
  async scheduleMessage(jid, text, date) {
    console.log(`[Scheduler Mock] Message programmé pour ${jid} le ${date}: ${text}`);
  }
}

// Exemple d'utilisation (pour démonstration)
// async function testActionInterpreter() {
//   const mockLlm = new MockLlmService();
//   const mockWhatsapp = new MockWhatsappService();
//   const mockVfs = new MockVfsService();
//   const mockLearning = new MockLearningLoop();
//   const mockScheduler = new MockSchedulerService();

//   const interpreter = new ActionInterpreter(mockLlm, mockWhatsapp, mockVfs, mockLearning, mockScheduler);
//   const jid = '1234567890@g.us';
//   const context = { membersCount: 10, rules: 'Pas de spam.' };
//   const intent = 'Annoncez que la réunion est reportée à demain et demandez la disponibilité des membres.';

//   const results = await interpreter.interpretIntent(jid, intent, context);
//   console.log('Résultats de l\'interprétation et de l\'exécution:', results);
// }
// testActionInterpreter();
