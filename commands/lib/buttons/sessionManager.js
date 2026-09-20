/**
 * Gestionnaire de sessions utilisateur
 * Gère les états d'attente (saisie texte / fichier)
 * DJOUSSE-TECH-MD
 */

const TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Map en mémoire : jid → { state, commandId, expiresAt }
const sessions = new Map();

module.exports = {
  /**
   * Met un utilisateur en attente
   * @param {string} jid - Identifiant de l'utilisateur
   * @param {string} commandId - ID de la commande en attente
   * @param {string} state - 'waiting_input' ou 'waiting_file'
   */
  setWaiting(jid, commandId, state = 'waiting_input') {
    sessions.set(jid, {
      state,
      commandId,
      expiresAt: Date.now() + TIMEOUT
    });
  },

  /**
   * Récupère la session d'un utilisateur (null si aucune ou expirée)
   * @param {string} jid
   * @returns {object|null}
   */
  getWaiting(jid) {
    const s = sessions.get(jid);
    if (!s) return null;
    if (Date.now() > s.expiresAt) {
      sessions.delete(jid);
      return null;
    }
    return s;
  },

  /**
   * Supprime la session d'un utilisateur
   * @param {string} jid
   */
  clear(jid) {
    sessions.delete(jid);
  },

  /**
   * Nombre de sessions actives
   */
  get activeCount() {
    let count = 0;
    for (const [, s] of sessions) {
      if (Date.now() <= s.expiresAt) count++;
    }
    return count;
  }
};
