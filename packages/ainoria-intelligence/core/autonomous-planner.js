/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  PLANIFICATEUR AUTONOME — Inspiré de Manus AI          ║
 * ║  Reçoit un objectif → planifie → exécute → itère       ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import { v4 as uuidv4 } from 'uuid'; // Pour générer des IDs uniques pour les plans

export class AutonomousPlanner {
  constructor(db, llmService, schedulerService) {
    this.db = db; // Service de base de données pour la persistance
    this.llmService = llmService; // Service pour les appels à Groq ou autre LLM
    this.schedulerService = schedulerService; // Service pour la planification des rappels
    this.PLAN_COLLECTION = 'autonomous_plans'; // Nom de la collection/table pour les plans
  }

  /**
   * Récupère un plan par son ID.
   * @param {string} planId - L'ID unique du plan.
   * @returns {Promise<object|null>} Le plan ou null si non trouvé.
   */
  async getPlan(planId) {
    return this.db.get(this.PLAN_COLLECTION, planId);
  }

  /**
   * Sauvegarde ou met à jour un plan.
   * @param {string} planId - L'ID unique du plan.
   * @param {object} planData - Les données du plan à sauvegarder.
   * @returns {Promise<void>}
   */
  async savePlan(planId, planData) {
    await this.db.save(this.PLAN_COLLECTION, planId, planData);
  }

  /**
   * Reçoit un objectif de haut niveau et le décompose en étapes.
   * Ex: "Organise un événement cybersécurité le mois prochain"
   * @param {string} jid - L'ID du groupe WhatsApp.
   * @param {string} objectif - L'objectif en langage naturel.
   * @returns {Promise<string>}
   */
  async createPlan(jid, objectif) {
    const prompt = `Décompose cet objectif en 5-8 étapes concrètes et ordonnées.
Objectif : "${objectif}"
Contexte : Groupe WhatsApp.

Format JSON : { "etapes": [ { "id": 1, "action": "...", "delai": "immédiat|J+3|J+7|J+14", "outil": "message|sondage|rappel|publication" } ] }`;

    let etapes;
    try {
      const llmResponse = await this.llmService.callGroq(prompt);
      // Tenter d'extraire le JSON si le LLM ajoute du texte autour
      const jsonMatch = llmResponse.match(/```json\n([\s\S]*?)\n```/);
      const rawJson = jsonMatch ? jsonMatch[1] : llmResponse;
      etapes = JSON.parse(rawJson).etapes;

      // Validation basique des étapes
      if (!Array.isArray(etapes) || etapes.some(e => !e.action || !e.outil)) {
        throw new Error('Structure d\'étapes invalide reçue du LLM.');
      }
    } catch (error) {
      console.error(`Erreur lors de la création du plan pour ${jid}:`, error);
      throw new Error(`Impossible de créer le plan. Erreur LLM: ${error.message}`);
    }

    const planId = uuidv4();
    const newPlan = {
      id: planId,
      jid,
      objectif,
      etapes,
      progression: 0,
      creeLe: Date.now(),
      status: 'en_cours',
    };

    await this.savePlan(planId, newPlan);
    await this.saveTodoFile(jid, newPlan); // Sauvegarder le todo.md virtuel

    return this.formaterPlan(newPlan);
  }

  /**
   * Exécute la prochaine étape du plan.
   * @param {string} planId - L'ID unique du plan.
   * @param {object} sock - L'objet socket WhatsApp pour envoyer des messages.
   * @returns {Promise<string>}
   */
  async executeNextStep(planId, sock) {
    const plan = await this.getPlan(planId);
    if (!plan || plan.status === 'termine') return null;

    const etapeActuelle = plan.etapes[plan.progression];
    if (!etapeActuelle) {
      plan.status = 'termine';
      await this.savePlan(planId, plan);
      await this.saveTodoFile(plan.jid, plan);
      return '✅ *Objectif atteint !* Toutes les étapes sont terminées.';
    }

    try {
      // Exécuter selon l'outil requis
      switch (etapeActuelle.outil) {
        case 'message':
          await sock.sendMessage(plan.jid, { text: `📋 *Étape ${plan.progression + 1}/${plan.etapes.length}*\n\n${etapeActuelle.action}` });
          break;
        case 'sondage':
          await sock.sendMessage(plan.jid, { poll: { name: etapeActuelle.action, values: ['Oui', 'Non', 'Peut-être'], selectableCount: 1 }});
          break;
        case 'rappel':
          // Utiliser le service de planification pour programmer un rappel
          await this.schedulerService.scheduleReminder(plan.jid, etapeActuelle.action, etapeActuelle.delai);
          break;
        case 'publication':
          await sock.sendMessage(plan.jid, { text: `📢 *ANNONCE*\n\n${etapeActuelle.action}` });
          break;
        default:
          console.warn(`Outil inconnu pour l'étape: ${etapeActuelle.outil}`);
          // Potentiellement marquer l'étape comme échouée ou notifier l'admin
          break;
      }

      plan.progression++;
      if (plan.progression >= plan.etapes.length) {
        plan.status = 'termine';
      }
      await this.savePlan(planId, plan);
      await this.saveTodoFile(plan.jid, plan);

      const nextStepText = plan.etapes[plan.progression]?.action || 'Terminé !';
      return `✅ Étape ${plan.progression}/${plan.etapes.length} terminée.\n\nProchaine : ${nextStepText}`;
    } catch (error) {
      console.error(`Erreur lors de l'exécution de l'étape ${plan.progression + 1} du plan ${planId}:`, error);
      // Enregistrer l'erreur et potentiellement notifier l'admin ou le LearningLoop
      throw new Error(`Échec de l'exécution de l'étape: ${error.message}`);
    }
  }

  /**
   * Sauvegarde le fichier todo.md virtuel (comme Manus AI).
   * @param {string} jid - L'ID du groupe WhatsApp.
   * @param {object} plan - Le plan à sauvegarder.
   * @returns {Promise<void>}
   */
  async saveTodoFile(jid, plan) {
    if (!plan) return;

    let todo = `# Objectif : ${plan.objectif}\n\n`;
    todo += `Statut : ${plan.status}\n`;
    todo += `Progression : ${plan.progression}/${plan.etapes.length}\n\n`;
    todo += `## Étapes :\n`;

    plan.etapes.forEach((e, i) => {
      const check = i < plan.progression ? '[x]' : '[ ]';
      todo += `${check} ${e.action} (${e.delai})\n`;
    });

    // Utiliser le VFS pour stocker le todo.md
    // Supposons que le VFS est accessible via this.db ou un service dédié
    await this.db.saveFile(jid, 'plans/todo.md', todo); // Méthode à implémenter dans le VFS
  }

  /**
   * Formate un plan pour l'affichage utilisateur.
   * @param {object} plan - Le plan à formater.
   * @returns {string}
   */
  formaterPlan(plan) {
    if (!plan) return 'Aucun plan actif.';

    let msg = `📋 *PLAN D'ACTION*\n\n🎯 Objectif : ${plan.objectif}\n\n`;
    plan.etapes.forEach((e, i) => {
      const emoji = i < plan.progression ? '✅' : i === plan.progression ? '▶️' : '⏳';
      msg += `${emoji} *${i + 1}.* ${e.action}\n   ⏰ ${e.delai}\n`;
    });
    msg += `\nProgression : ${plan.progression}/${plan.etapes.length}`;
    return msg;
  }
}

// --- Placeholder pour les services externes ---
// Ces classes/fonctions devraient être implémentées ailleurs et passées au constructeur

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

  async saveFile(groupId, filename, content) {
    console.log(`[VFS Mock] Fichier ${filename} pour groupe ${groupId} sauvegardé.`);
    // Implémentation réelle devrait utiliser le VirtualFileSystem
  }
}

class MockLlmService {
  async callGroq(prompt) {
    console.log(`[LLM Mock] Appel Groq avec prompt: ${prompt.substring(0, 100)}...`);
    // Simule une réponse JSON valide pour le test
    return JSON.stringify({
      etapes: [
        { id: 1, action: 'Définir la date de l\'événement', delai: 'immédiat', outil: 'message' },
        { id: 2, action: 'Créer une invitation détaillée', delai: 'J+3', outil: 'publication' },
        { id: 3, action: 'Envoyer un sondage pour la participation', delai: 'J+7', outil: 'sondage' },
        { id: 4, action: 'Envoyer un rappel aux participants', delai: 'J+14', outil: 'rappel' },
        { id: 5, action: 'Finaliser la liste des participants', delai: 'J+20', outil: 'message' },
      ],
    });
  }
}

class MockSchedulerService {
  async scheduleReminder(jid, message, delai) {
    console.log(`[Scheduler Mock] Rappel programmé pour ${jid}: ${message} dans ${delai}`);
    // Implémentation réelle utiliserait un système de planification asynchrone
  }
}

// Exemple d'utilisation (pour démonstration)
// const db = new MockDbService();
// const llm = new MockLlmService();
// const scheduler = new MockSchedulerService();
// const planner = new AutonomousPlanner(db, llm, scheduler);

// async function testPlanner() {
//   const jid = '1234567890@g.us';
//   const objectif = 'Organiser un atelier sur la cybersécurité';
//   const planFormatted = await planner.createPlan(jid, objectif);
//   console.log(planFormatted);

//   // Simuler l'exécution des étapes
//   // await planner.executeNextStep(plan.id, mockSock);
// }
// testPlanner();
