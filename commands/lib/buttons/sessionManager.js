/**
 * Gestionnaire de sessions utilisateur
 * Gère les états d'attente (saisie texte / fichier)
 * ET le contexte de menu (pour interception numéro)
 * DJOUSSE-TECH-MD
 */

const TIMEOUT = 5 * 60 * 1000;       // 5 minutes pour saisie
const MENU_TIMEOUT = 10 * 60 * 1000; // 10 minutes pour menu

const sessions = new Map();
const menuContexts = new Map();

module.exports = {
  // ═══════════════════════════════════════════════════════
  // SESSIONS D'ATTENTE (TYPE B et C)
  // ═══════════════════════════════════════════════════════
  setWaiting(jid, commandId, state = 'waiting_input') {
    sessions.set(jid, {
      state,
      commandId,
      expiresAt: Date.now() + TIMEOUT
    });
  },

  getWaiting(jid) {
    const s = sessions.get(jid);
    if (!s) return null;
    if (Date.now() > s.expiresAt) {
      sessions.delete(jid);
      return null;
    }
    return s;
  },

  clear(jid) {
    sessions.delete(jid);
  },

  // ═══════════════════════════════════════════════════════
  // CONTEXTE DE MENU (pour interception numéro)
  // ═══════════════════════════════════════════════════════
  setMenuContext(jid, context) {
    menuContexts.set(jid, {
      ...context,
      expiresAt: Date.now() + MENU_TIMEOUT
    });
  },

  getMenuContext(jid) {
    const ctx = menuContexts.get(jid);
    if (!ctx) return null;
    if (Date.now() > ctx.expiresAt) {
      menuContexts.delete(jid);
      return null;
    }
    return ctx;
  },

  clearMenuContext(jid) {
    menuContexts.delete(jid);
  },

  // ═══════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════
  get activeCount() {
    let count = 0;
    for (const [, s] of sessions) {
      if (Date.now() <= s.expiresAt) count++;
    }
    return count;
  },

  get menuCount() {
    let count = 0;
    for (const [, c] of menuContexts) {
      if (Date.now() <= c.expiresAt) count++;
    }
    return count;
  }
};
