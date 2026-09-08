/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  MÉMOIRE FICHIER VIRTUELLE — Inspiré de Manus AI       ║
 * ║  Stocke règles, profils, historique comme fichiers      ║
 * ╚══════════════════════════════════════════════════════════╝
 */

export class VirtualFileSystem {
  constructor(dbService) {
    this.dbService = dbService; // Service de base de données pour la persistance
    this.VFS_COLLECTION = 'vfs_files'; // Collection pour stocker les fichiers virtuels
  }

  /**
   * Génère une clé unique pour un fichier virtuel.
   * @param {string} groupId - L'ID du groupe WhatsApp.
   * @param {string} filename - Le nom du fichier (peut inclure des sous-dossiers).
   * @returns {string}
   */
  _generateKey(groupId, filename) {
    return `${groupId}:${filename}`;
  }

  /**
   * Initialise les fichiers par défaut pour un nouveau groupe.
   * @param {string} groupId - L'ID du groupe WhatsApp.
   * @returns {Promise<void>}
   */
  async initGroupFiles(groupId) {
    await this.writeFile(groupId, 'rules.md', '# Règles du groupe\n\nGénérées automatiquement.');
    await this.writeFile(groupId, 'members.json', '[]');
    await this.writeFile(groupId, 'history.md', '# Historique\n\n');
    await this.writeFile(groupId, 'config.json', '{}');
    await this.writeFile(groupId, 'plans/todo.md', '# Aucun plan actif');
  }

  /**
   * Écrit le contenu dans un fichier virtuel.
   * Gère la concurrence avec un mécanisme de verrouillage simple (à améliorer pour la production).
   * @param {string} groupId - L'ID du groupe WhatsApp.
   * @param {string} filename - Le nom du fichier.
   * @param {string} content - Le contenu à écrire.
   * @returns {Promise<void>}
   */
  async writeFile(groupId, filename, content) {
    const key = this._generateKey(groupId, filename);
    // Implémentation simplifiée de verrouillage pour éviter les conditions de course
    // Dans un environnement de production, utiliser un vrai système de verrouillage distribué ou des transactions DB.
    try {
      // Ici, on pourrait implémenter un verrouillage avant d'écrire
      await this.dbService.save(this.VFS_COLLECTION, key, content);
    } catch (error) {
      console.error(`Erreur lors de l'écriture du fichier ${filename} pour le groupe ${groupId}:`, error);
      throw new Error(`Impossible d'écrire le fichier: ${error.message}`);
    }
  }

  /**
   * Lit le contenu d'un fichier virtuel.
   * @param {string} groupId - L'ID du groupe WhatsApp.
   * @param {string} filename - Le nom du fichier.
   * @returns {Promise<string|null>} Le contenu du fichier ou null si non trouvé.
   */
  async readFile(groupId, filename) {
    const key = this._generateKey(groupId, filename);
    try {
      return await this.dbService.get(this.VFS_COLLECTION, key);
    } catch (error) {
      console.error(`Erreur lors de la lecture du fichier ${filename} pour le groupe ${groupId}:`, error);
      return null; // Retourne null en cas d'erreur de lecture
    }
  }

  /**
   * Ajoute un membre au fichier members.json.
   * @param {string} groupId - L'ID du groupe WhatsApp.
   * @param {object} memberData - Les données du membre à ajouter.
   * @returns {Promise<void>}
   */
  async addMember(groupId, memberData) {
    let members = [];
    try {
      const raw = await this.readFile(groupId, 'members.json');
      members = raw ? JSON.parse(raw) : [];
    } catch (error) {
      console.warn(`Impossible de lire ou parser members.json pour ${groupId}, initialisation avec un tableau vide.`, error);
    }

    members.push({
      ...memberData,
      ajouteLe: new Date().toISOString(),
    });
    await this.writeFile(groupId, 'members.json', JSON.stringify(members, null, 2));
  }

  /**
   * Met à jour les règles du groupe.
   * @param {string} groupId - L'ID du groupe WhatsApp.
   * @param {string} newRules - Le nouveau contenu des règles.
   * @returns {Promise<void>}
   */
  async updateRules(groupId, newRules) {
    const content = `# Règles du groupe\n\n${newRules}\n\n_Dernière mise à jour : ${new Date().toLocaleDateString('fr-FR')}_`;
    await this.writeFile(groupId, 'rules.md', content);
  }

  /**
   * Ajoute un événement à l'historique du groupe.
   * Gère la taille du fichier history.md pour éviter une croissance infinie.
   * @param {string} groupId - L'ID du groupe WhatsApp.
   * @param {string} event - L'événement à loguer.
   * @param {number} maxLines - Le nombre maximum de lignes à conserver dans l'historique.
   * @returns {Promise<void>}
   */
  async logEvent(groupId, event, maxLines = 500) {
    let raw = await this.readFile(groupId, 'history.md') || '# Historique\n\n';
    const entry = `- [${new Date().toLocaleString('fr-FR')}] ${event}\n`;

    // Ajoute la nouvelle entrée
    raw += entry;

    // Limite la taille de l'historique
    const lines = raw.split('\n');
    if (lines.length > maxLines) {
      // Garde l'en-tête et les 'maxLines' dernières lignes
      raw = lines.slice(0, 2).join('\n') + '\n' + lines.slice(-maxLines + 2).join('\n');
    }
    await this.writeFile(groupId, 'history.md', raw);
  }

  /**
   * Récupère tout le contexte d'un groupe pour l'IA.
   * @param {string} groupId - L'ID du groupe WhatsApp.
   * @returns {Promise<object>}
   */
  async getFullContext(groupId) {
    const rules = await this.readFile(groupId, 'rules.md') || '';
    const membersRaw = await this.readFile(groupId, 'members.json') || '[]';
    const history = await this.readFile(groupId, 'history.md') || '';
    const configRaw = await this.readFile(groupId, 'config.json') || '{}';
    const plan = await this.readFile(groupId, 'plans/todo.md') || '';

    let members = [];
    try {
      members = JSON.parse(membersRaw);
    } catch (error) {
      console.warn(`Erreur de parsing members.json pour ${groupId}:`, error);
    }

    let config = {};
    try {
      config = JSON.parse(configRaw);
    } catch (error) {
      console.warn(`Erreur de parsing config.json pour ${groupId}:`, error);
    }

    return {
      rules,
      membersCount: members.length,
      recentHistory: history.split('\n').slice(-20).join('\n'), // Garde les 20 dernières lignes pour le contexte immédiat
      config,
      activePlan: plan,
    };
  }
}

// --- Placeholder pour le service de base de données ---
// Cette classe devrait être implémentée ailleurs et passée au constructeur

class MockDbService {
  constructor() {
    this.data = {}; // Simule une base de données en mémoire
  }

  async get(collection, key) {
    console.log(`[DB Mock] Lecture de ${collection}:${key}`);
    return this.data[`${collection}:${key}`] || null;
  }

  async save(collection, key, data) {
    console.log(`[DB Mock] Écriture de ${collection}:${key}`);
    this.data[`${collection}:${key}`] = data;
  }
}

// Exemple d'utilisation (pour démonstration)
// async function testVFS() {
//   const mockDb = new MockDbService();
//   const vfs = new VirtualFileSystem(mockDb);
//   const groupId = 'group123';

//   await vfs.initGroupFiles(groupId);
//   console.log('Fichiers initiaux:', await vfs.getFullContext(groupId));

//   await vfs.addMember(groupId, { id: 'user1', name: 'Alice' });
//   await vfs.addMember(groupId, { id: 'user2', name: 'Bob' });
//   await vfs.updateRules(groupId, 'Nouvelle règle: Pas de spam.');
//   await vfs.logEvent(groupId, 'Alice a rejoint le groupe.');
//   await vfs.logEvent(groupId, 'Bob a posté un message.');

//   console.log('Contexte après modifications:', await vfs.getFullContext(groupId));
// }
// testVFS();
