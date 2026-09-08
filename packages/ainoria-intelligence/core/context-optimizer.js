/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  OPTIMISATEUR DE CONTEXTE — Inspiré de Manus AI        ║
 * ║  Reformule les objectifs pour garder l'IA focalisée     ║
 * ╚══════════════════════════════════════════════════════════╝
 */

export class ContextOptimizer {
  constructor(dbService, llmService) {
    this.dbService = dbService; // Service de base de données pour la persistance
    this.llmService = llmService; // Service pour les appels à Groq ou autre LLM
    this.OBJECTIVES_COLLECTION = 'group_objectives';
    this.REFORMULATION_INTERVAL_MS = 3600000; // 1 heure
  }

  /**
   * Définit ou met à jour l'objectif principal du groupe.
   * @param {string} jid - L'ID du groupe WhatsApp.
   * @param {string} objectif - Le nouvel objectif.
   * @returns {Promise<void>}
   */
  async setObjective(jid, objectif) {
    const obj = await this.dbService.get(this.OBJECTIVES_COLLECTION, jid) || {
      objectif: '',
      derniereReformulation: 0,
      historique: [],
    };

    obj.objectif = objectif;
    obj.derniereReformulation = Date.now();
    obj.historique.push(objectif);
    if (obj.historique.length > 10) obj.historique.shift(); // Garder seulement les 10 dernières

    await this.dbService.save(this.OBJECTIVES_COLLECTION, jid, obj);
  }

  /**
   * Récupère l'objectif actuel du groupe.
   * @param {string} jid - L'ID du groupe WhatsApp.
   * @returns {Promise<object|null>} L'objet objectif ou null.
   */
  async getObjective(jid) {
    return this.dbService.get(this.OBJECTIVES_COLLECTION, jid);
  }

  /**
   * Reformule l'objectif pour maintenir l'attention de l'IA.
   * (Comme le todo.md de Manus AI)
   * @param {string} jid - L'ID du groupe WhatsApp.
   * @param {string} recentContext - Un résumé du contexte récent du groupe.
   * @returns {Promise<string|null>} La nouvelle formulation ou null si pas de reformulation nécessaire.
   */
  async reformulateObjective(jid, recentContext) {
    const obj = await this.getObjective(jid);
    if (!obj || !obj.objectif) return null;

    // Reformuler seulement après un certain intervalle
    if (Date.now() - obj.derniereReformulation < this.REFORMULATION_INTERVAL_MS) {
      return null;
    }

    const prompt = `Reformule cet objectif de groupe de façon concise pour guider l'IA.\nObjectif original : "${obj.objectif}"\nContexte récent : ${recentContext}\n\nNouvelle formulation (1 phrase) :`;

    try {
      const newFormulation = await this.llmService.callGroq(prompt);
      obj.objectif = newFormulation.trim(); // Supprimer les espaces superflus
      obj.derniereReformulation = Date.now();
      obj.historique.push(obj.objectif);
      if (obj.historique.length > 10) obj.historique.shift();

      await this.dbService.save(this.OBJECTIVES_COLLECTION, jid, obj);
      return obj.objectif;
    } catch (error) {
      console.error(`Erreur lors de la reformulation de l'objectif pour ${jid}:`, error);
      return null; // Retourne null en cas d'échec de reformulation
    }
  }

  /**
   * Génère un résumé périodique de l'état du groupe.
   * @param {string} jid - L'ID du groupe WhatsApp.
   * @returns {Promise<string>}
   */
  async generateSummary(jid) {
    const obj = await this.getObjective(jid);
    const prompt = `Génère un résumé ultra-concis (2 phrases) de l'état actuel du groupe.\nObjectif : ${obj?.objectif || 'Non défini'}\nProgression : ${obj?.historique?.length || 0} reformulations effectuées.\n\nRésumé :`;

    try {
      return await this.llmService.callGroq(prompt);
    } catch (error) {
      console.error(`Erreur lors de la génération du résumé pour ${jid}:`, error);
      return `Impossible de générer un résumé pour le moment. Objectif: ${obj?.objectif || 'Non défini'}`;
    }
  }
}

// --- Placeholder pour les services externes ---

class MockDbService {
  constructor() {
    this.data = {}; // Simule une base de données en mémoire
  }

  async get(collection, id) {
    return this.data[`${collection}:${id}`] || null;
  }

  async save(collection, id, data) {
    this.data[`${collection}:${id}`] = data;
  }
}

class MockLlmService {
  async callGroq(prompt) {
    console.log(`[LLM Mock] Appel Groq avec prompt: ${prompt.substring(0, Math.min(prompt.length, 100))}...`);
    if (prompt.includes("Reformule cet objectif")) {
      return "Nouvel objectif reformulé: Assurer la participation maximale à l'événement cybersécurité.";
    } else if (prompt.includes("Génère un résumé")) {
      return "Le groupe est en phase d'organisation d'un événement cybersécurité. Le système travaille à optimiser la participation des membres.";
    }
    return "";
  }
}

// Exemple d'utilisation (pour démonstration)
// async function testContextOptimizer() {
//   const mockDb = new MockDbService();
//   const mockLlm = new MockLlmService();
//   const contextOptimizer = new ContextOptimizer(mockDb, mockLlm);
//   const jid = '1234567890@g.us';

//   await contextOptimizer.setObjective(jid, 'Organiser un événement sur la cybersécurité le mois prochain.');
//   console.log('Objectif initial:', await contextOptimizer.getObjective(jid));

//   // Simuler un délai
//   await new Promise(resolve => setTimeout(resolve, 3700000)); 

//   const newFormulation = await contextOptimizer.reformulateObjective(jid, 'Discussion récente sur les dates préférées.');
//   console.log('Nouvelle formulation:', newFormulation);

//   const summary = await contextOptimizer.generateSummary(jid);
//   console.log('Résumé du groupe:', summary);
// }
// testContextOptimizer();
