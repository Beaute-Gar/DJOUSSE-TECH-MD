/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  BOUCLE D'APPRENTISSAGE — Inspiré de Manus AI          ║
 * ║  Analyse les erreurs → s'adapte → s'améliore            ║
 * ╚══════════════════════════════════════════════════════════╝
 */

export class LearningLoop {
  constructor(dbService, llmService, whatsappService) {
    this.dbService = dbService; // Service de base de données pour la persistance
    this.llmService = llmService; // Service pour les appels à Groq ou autre LLM
    this.whatsappService = whatsappService; // Service pour envoyer des notifications à l'admin
    this.ERROR_LOG_COLLECTION = 'learning_errors';
    this.SUCCESS_LOG_COLLECTION = 'learning_successes';
    this.IMPROVEMENTS_COLLECTION = 'learning_improvements';
    this.MAX_LOG_ENTRIES = 100; // Limite le nombre d'entrées de log par groupe
  }

  /**
   * Enregistre une erreur et tente de la résoudre.
   * @param {string} jid - L'ID du groupe WhatsApp.
   * @param {Error} error - L'objet erreur.
   * @param {object} context - Contexte de l'erreur (intention, action, phase, etc.).
   * @returns {Promise<object>} La solution proposée et l'action.
   */
  async handleError(jid, error, context) {
    const errorEntry = {
      erreur: error.message,
      stack: error.stack,
      contexte: context,
      timestamp: Date.now(),
    };

    // Enregistrer l'erreur en base de données
    await this.dbService.addLogEntry(this.ERROR_LOG_COLLECTION, jid, errorEntry, this.MAX_LOG_ENTRIES);

    // Analyser et proposer une solution via LLM
    const prompt = `Une erreur s'est produite dans le groupe WhatsApp.\nErreur : ${error.message}\nContexte : ${JSON.stringify(context)}\n\nPropose UNE solution concrète pour éviter cette erreur à l'avenir.\nFormat : { "solution": "...", "action": "modifier_regle|ajuster_parametre|notifier_admin|ignorer" }`;

    let analysis;
    try {
      const llmResponse = await this.llmService.callGroq(prompt);
      const jsonMatch = llmResponse.match(/```json\n([\s\S]*?)\n```/);
      const rawJson = jsonMatch ? jsonMatch[1] : llmResponse;
      analysis = JSON.parse(rawJson);

      if (!analysis.solution || !analysis.action) {
        throw new Error("LLM n'a pas retourné une solution ou une action valide.");
      }
    } catch (llmError) {
      console.error(`Erreur lors de l'analyse LLM de l'erreur pour ${jid}:`, llmError);
      // Fallback: notifier l'admin si l'analyse LLM échoue
      await this.notifyAdmin(jid, error, "Le système n'a pas pu analyser l'erreur, veuillez vérifier manuellement.");
      return { solution: "Analyse LLM échouée", action: "notifier_admin" };
    }

    const { solution, action } = analysis;

    // Appliquer la solution
    switch (action) {
      case 'modifier_regle':
        // Cette logique devrait interagir avec le VFS ou un service de gestion de règles
        await this.adjustRules(jid, solution);
        break;
      case 'ajuster_parametre':
        // Cette logique devrait interagir avec un service de configuration
        await this.adjustSettings(jid, solution);
        break;
      case 'notifier_admin':
        await this.notifyAdmin(jid, error, solution);
        break;
      case 'ignorer':
        // Ne rien faire, l'erreur est jugée non critique ou temporaire
        break;
      default:
        console.warn(`Action de solution inconnue: ${action}. Notification de l'admin.`);
        await this.notifyAdmin(jid, error, solution);
        break;
    }

    // Enregistrer l'amélioration
    await this.dbService.addLogEntry(this.IMPROVEMENTS_COLLECTION, jid, { solution, action, timestamp: Date.now() }, this.MAX_LOG_ENTRIES);

    return { solution, action };
  }

  /**
   * Enregistre le succès d'une action.
   * @param {string} jid - L'ID du groupe WhatsApp.
   * @param {string} action - Le nom de l'action réussie.
   * @param {any} result - Le résultat de l'action.
   * @returns {Promise<void>}
   */
  async logSuccess(jid, action, result) {
    const successEntry = {
      action,
      result,
      timestamp: Date.now(),
    };
    await this.dbService.addLogEntry(this.SUCCESS_LOG_COLLECTION, jid, successEntry, this.MAX_LOG_ENTRIES);
  }

  /**
   * Analyse les patterns d'erreurs pour des améliorations proactives.
   * @param {string} jid - L'ID du groupe WhatsApp.
   * @returns {Promise<object|null>} Une suggestion d'amélioration ou null.
   */
  async analyzePatterns(jid) {
    const errors = await this.dbService.getLogEntries(this.ERROR_LOG_COLLECTION, jid);
    if (errors.length < 5) return null; // Pas assez de données pour une analyse significative

    const recentErrors = errors.slice(-20); // Analyse les 20 dernières erreurs
    const errorTypes = recentErrors.map(e => e.erreur.split(':')[0].trim());
    const mostCommon = this.mostFrequent(errorTypes);

    if (mostCommon.count >= 3) {
      const prompt = `Un pattern d'erreur récurrent a été détecté dans le groupe WhatsApp.\nType d'erreur le plus fréquent : "${mostCommon.value}" (${mostCommon.count} occurrences récentes).\nContexte des erreurs : ${JSON.stringify(recentErrors.map(e => e.contexte))}\n\nPropose une suggestion proactive pour résoudre ce pattern d'erreur.\nFormat : { "suggestion": "..." }`;
      try {
        const llmResponse = await this.llmService.callGroq(prompt);
        const jsonMatch = llmResponse.match(/```json\n([\s\S]*?)\n```/);
        const rawJson = jsonMatch ? jsonMatch[1] : llmResponse;
        const llmSuggestion = JSON.parse(rawJson);
        return {
          pattern: mostCommon.value,
          count: mostCommon.count,
          suggestion: llmSuggestion.suggestion,
        };
      } catch (llmError) {
        console.error(`Erreur lors de la génération de suggestion LLM pour ${jid}:`, llmError);
        return {
          pattern: mostCommon.value,
          count: mostCommon.count,
          suggestion: `Un pattern d'erreur récurrent a été détecté: ${mostCommon.value}. Le système n'a pas pu générer de suggestion spécifique.`, 
        };
      }
    }

    return null;
  }

  /**
   * Trouve l'élément le plus fréquent dans un tableau.
   * @param {Array<string>} arr - Le tableau d'éléments.
   * @returns {{value: string, count: number}}
   */
  mostFrequent(arr) {
    const counts = {};
    arr.forEach(val => { counts[val] = (counts[val] || 0) + 1; });
    let maxCount = 0;
    let maxValue = '';
    for (const val in counts) {
      if (counts[val] > maxCount) {
        maxCount = counts[val];
        maxValue = val;
      }
    }
    return { value: maxValue, count: maxCount };
  }

  async adjustRules(jid, solution) {
    console.log(`[LearningLoop] Ajustement des règles pour ${jid} avec solution: ${solution}`);
    // Ici, interagir avec VirtualFileSystem pour mettre à jour les règles
    // Ex: await this.vfsService.updateRules(jid, solution);
  }

  async adjustSettings(jid, solution) {
    console.log(`[LearningLoop] Ajustement des paramètres pour ${jid} avec solution: ${solution}`);
    // Ici, interagir avec un service de configuration du bot
  }

  async notifyAdmin(jid, error, solution) {
    console.log(`[LearningLoop] Notification admin pour ${jid}. Erreur: ${error.message}, Solution: ${solution}`);
    // Envoyer un message à l'administrateur du groupe via WhatsApp
    const adminMessage = `🚨 *Alerte Erreur DJOUSSE TECH* 🚨\n\nUne erreur est survenue dans votre groupe.\n*Erreur:* ${error.message}\n*Contexte:* ${JSON.stringify(error.contexte || {})}\n*Solution proposée par le système:* ${solution}\n\nVeuillez vérifier le fonctionnement du bot.`;
    // await this.whatsappService.sendMessage(jid, { text: adminMessage }); // Supposons que jid est l'admin ou un groupe d'alerte
  }
}

// --- Placeholder pour les services externes ---

class MockDbService {
  constructor() {
    this.data = {}; // Simule une base de données en mémoire
  }

  async addLogEntry(collection, jid, entry, maxEntries) {
    if (!this.data[collection]) this.data[collection] = {};
    if (!this.data[collection][jid]) this.data[collection][jid] = [];
    this.data[collection][jid].push(entry);
    if (this.data[collection][jid].length > maxEntries) {
      this.data[collection][jid].shift(); // Supprime l'entrée la plus ancienne
    }
    console.log(`[DB Mock] Log ajouté à ${collection} pour ${jid}. Total: ${this.data[collection][jid].length}`);
  }

  async getLogEntries(collection, jid) {
    return this.data[collection]?.[jid] || [];
  }
}

class MockLlmService {
  async callGroq(prompt) {
    console.log(`[LLM Mock] Appel Groq avec prompt: ${prompt.substring(0, Math.min(prompt.length, 100))}...`);
    // Simule une réponse JSON valide pour le test
    if (prompt.includes("Propose UNE solution")) {
      return JSON.stringify({ solution: "Vérifier la connexion internet", action: "notifier_admin" });
    } else if (prompt.includes("Propose une suggestion proactive")) {
      return JSON.stringify({ suggestion: "Implémenter un mécanisme de retry automatique pour les appels API externes." });
    }
    return JSON.stringify({});
  }
}

class MockWhatsappService {
  async sendMessage(jid, content) {
    console.log(`[WhatsApp Mock] Message envoyé à ${jid}:`, content);
  }
}

// Exemple d'utilisation (pour démonstration)
// async function testLearningLoop() {
//   const mockDb = new MockDbService();
//   const mockLlm = new MockLlmService();
//   const mockWhatsapp = new MockWhatsappService();
//   const learningLoop = new LearningLoop(mockDb, mockLlm, mockWhatsapp);
//   const jid = '1234567890@g.us';

//   // Simuler quelques erreurs
//   await learningLoop.handleError(jid, new Error('API_CALL_FAILED: Timeout'), { action: 'send_message' });
//   await learningLoop.handleError(jid, new Error('API_CALL_FAILED: Network error'), { action: 'send_message' });
//   await learningLoop.handleError(jid, new Error('INVALID_PARAM: Text missing'), { action: 'create_poll' });
//   await learningLoop.handleError(jid, new Error('API_CALL_FAILED: Server down'), { action: 'send_message' });
//   await learningLoop.handleError(jid, new Error('API_CALL_FAILED: Timeout'), { action: 'send_message' });

//   // Simuler quelques succès
//   await learningLoop.logSuccess(jid, 'send_message', 'Message OK');

//   // Analyser les patterns
//   const suggestion = await learningLoop.analyzePatterns(jid);
//   console.log('Suggestion d\'amélioration:', suggestion);
// }
// testLearningLoop();
