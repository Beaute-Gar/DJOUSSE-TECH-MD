/**
 * Action Engine — DJOUSSE-TECH-MD
 * 
 * Exécute des actions réelles via Baileys avec tracking de statut complet.
 * Chaque action retourne un résultat vérifié.
 * 
 * Statuts: REQUESTED → EXECUTING → SUCCESS | FAILED | NOT_SUPPORTED | NO_PERMISSION
 */

const fs = require('fs');
const path = require('path');

const ACTION_STATUS = {
  REQUESTED: 'REQUESTED',
  EXECUTING: 'EXECUTING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  NOT_SUPPORTED: 'NOT_SUPPORTED',
  NO_PERMISSION: 'NO_PERMISSION',
};

class ActionEngine {
  constructor(sock) {
    this.sock = sock;
    this.actionLog = [];
    this.maxLogSize = 500;
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      noPermission: 0,
      notSupported: 0,
    };
  }

  /**
   * Mettre à jour le socket (reconnexion)
   */
  setSocket(sock) {
    this.sock = sock;
  }

  /**
   * Enregistrer une action dans le log
   */
  _logAction(action) {
    this.actionLog.unshift(action);
    if (this.actionLog.length > this.maxLogSize) this.actionLog.pop();
    this.stats.total++;
    if (action.status === ACTION_STATUS.SUCCESS) this.stats.success++;
    else if (action.status === ACTION_STATUS.FAILED) this.stats.failed++;
    else if (action.status === ACTION_STATUS.NO_PERMISSION) this.stats.noPermission++;
    else if (action.status === ACTION_STATUS.NOT_SUPPORTED) this.stats.notSupported++;
  }

  /**
   * Vérifier si le bot est connecté
   */
  _checkConnection() {
    if (!this.sock || !this.sock.user) {
      return { ok: false, reason: 'Bot non connecté' };
    }
    return { ok: true };
  }

  /**
   * Vérifier si le bot est admin dans un groupe
   */
  async _checkGroupAdmin(chatJid) {
    if (!this.sock) return { ok: false, reason: 'Socket non disponible' };
    try {
      const metadata = await this.sock.groupMetadata(chatJid);
      const botJid = this.sock.user?.id;
      const botNumber = String(botJid).split(':')[0].split('@')[0];
      const participant = metadata.participants?.find(p => {
        const pNum = String(p.id).split(':')[0].split('@')[0];
        return pNum === botNumber;
      });
      if (!participant) return { ok: false, reason: 'Bot non membre du groupe' };
      if (participant.admin !== 'admin' && participant.admin !== 'superadmin') {
        return { ok: false, reason: 'Bot non admin du groupe', permission: 'CAN_MODERATE' };
      }
      return { ok: true, metadata };
    } catch (e) {
      return { ok: false, reason: `Erreur metadata: ${e.message}` };
    }
  }

  /**
   * Envoyer un message texte
   */
  async sendMessage(jid, text, options = {}) {
    const action = {
      type: 'SEND_MESSAGE',
      jid,
      status: ACTION_STATUS.REQUESTED,
      timestamp: Date.now(),
      verified: false,
    };

    const conn = this._checkConnection();
    if (!conn.ok) {
      action.status = ACTION_STATUS.FAILED;
      action.error = conn.reason;
      this._logAction(action);
      return action;
    }

    try {
      action.status = ACTION_STATUS.EXECUTING;
      const result = await this.sock.sendMessage(jid, { text }, options);
      action.status = ACTION_STATUS.SUCCESS;
      action.verified = !!result?.key?.id;
      action.messageId = result?.key?.id;
      action.timestamp = Date.now();
    } catch (e) {
      action.status = ACTION_STATUS.FAILED;
      action.error = e.message;
      action.errorCode = e.output?.statusCode;
    }

    this._logAction(action);
    return action;
  }

  /**
   * Supprimer un message
   */
  async deleteMessage(chatJid, messageKey) {
    const action = {
      type: 'DELETE_MESSAGE',
      chatJid,
      messageId: messageKey?.id,
      status: ACTION_STATUS.REQUESTED,
      timestamp: Date.now(),
      verified: false,
    };

    const conn = this._checkConnection();
    if (!conn.ok) {
      action.status = ACTION_STATUS.FAILED;
      action.error = conn.reason;
      this._logAction(action);
      return action;
    }

    try {
      action.status = ACTION_STATUS.EXECUTING;
      const result = await this.sock.sendMessage(chatJid, { delete: messageKey });
      action.status = ACTION_STATUS.SUCCESS;
      action.verified = true;
      action.timestamp = Date.now();
    } catch (e) {
      const errCode = e.output?.statusCode;
      if (errCode === 403 || errCode === 401) {
        action.status = ACTION_STATUS.NO_PERMISSION;
        action.error = 'Pas assez de permissions pour supprimer ce message';
      } else if (errCode === 404) {
        action.status = ACTION_STATUS.FAILED;
        action.error = 'Message non trouvé (déjà supprimé ?)';
      } else {
        action.status = ACTION_STATUS.FAILED;
        action.error = e.message;
      }
      action.errorCode = errCode;
    }

    this._logAction(action);
    return action;
  }

  /**
   * Retirer un participant d'un groupe
   */
  async removeParticipant(chatJid, participantJid) {
    const action = {
      type: 'REMOVE_PARTICIPANT',
      chatJid,
      participantJid,
      status: ACTION_STATUS.REQUESTED,
      timestamp: Date.now(),
      verified: false,
    };

    const conn = this._checkConnection();
    if (!conn.ok) {
      action.status = ACTION_STATUS.FAILED;
      action.error = conn.reason;
      this._logAction(action);
      return action;
    }

    const adminCheck = await this._checkGroupAdmin(chatJid);
    if (!adminCheck.ok) {
      action.status = ACTION_STATUS.NO_PERMISSION;
      action.error = adminCheck.reason;
      this._logAction(action);
      return action;
    }

    try {
      action.status = ACTION_STATUS.EXECUTING;
      const result = await this.sock.groupParticipantsUpdate(chatJid, [participantJid], 'remove');
      action.status = ACTION_STATUS.SUCCESS;
      action.verified = Array.isArray(result);
      action.timestamp = Date.now();
    } catch (e) {
      const errCode = e.output?.statusCode;
      if (errCode === 403 || errCode === 401) {
        action.status = ACTION_STATUS.NO_PERMISSION;
        action.error = 'Le bot n\'est pas admin ou n\'a pas les permissions';
      } else {
        action.status = ACTION_STATUS.FAILED;
        action.error = e.message;
      }
      action.errorCode = errCode;
    }

    this._logAction(action);
    return action;
  }

  /**
   * Promouvoir un admin
   */
  async promoteParticipant(chatJid, participantJid) {
    const action = {
      type: 'PROMOTE_PARTICIPANT',
      chatJid,
      participantJid,
      status: ACTION_STATUS.REQUESTED,
      timestamp: Date.now(),
      verified: false,
    };

    const conn = this._checkConnection();
    if (!conn.ok) {
      action.status = ACTION_STATUS.FAILED;
      action.error = conn.reason;
      this._logAction(action);
      return action;
    }

    const adminCheck = await this._checkGroupAdmin(chatJid);
    if (!adminCheck.ok) {
      action.status = ACTION_STATUS.NO_PERMISSION;
      action.error = adminCheck.reason;
      this._logAction(action);
      return action;
    }

    try {
      action.status = ACTION_STATUS.EXECUTING;
      const result = await this.sock.groupParticipantsUpdate(chatJid, [participantJid], 'promote');
      action.status = ACTION_STATUS.SUCCESS;
      action.verified = Array.isArray(result);
    } catch (e) {
      action.status = ACTION_STATUS.FAILED;
      action.error = e.message;
    }

    this._logAction(action);
    return action;
  }

  /**
   * Rétrograder un admin
   */
  async demoteParticipant(chatJid, participantJid) {
    const action = {
      type: 'DEMOTE_PARTICIPANT',
      chatJid,
      participantJid,
      status: ACTION_STATUS.REQUESTED,
      timestamp: Date.now(),
      verified: false,
    };

    const conn = this._checkConnection();
    if (!conn.ok) {
      action.status = ACTION_STATUS.FAILED;
      action.error = conn.reason;
      this._logAction(action);
      return action;
    }

    const adminCheck = await this._checkGroupAdmin(chatJid);
    if (!adminCheck.ok) {
      action.status = ACTION_STATUS.NO_PERMISSION;
      action.error = adminCheck.reason;
      this._logAction(action);
      return action;
    }

    try {
      action.status = ACTION_STATUS.EXECUTING;
      const result = await this.sock.groupParticipantsUpdate(chatJid, [participantJid], 'demote');
      action.status = ACTION_STATUS.SUCCESS;
      action.verified = Array.isArray(result);
    } catch (e) {
      action.status = ACTION_STATUS.FAILED;
      action.error = e.message;
    }

    this._logAction(action);
    return action;
  }

  /**
   * Ajouter une réaction
   */
  async react(chatJid, messageKey, emoji) {
    const action = {
      type: 'REACT',
      chatJid,
      messageId: messageKey?.id,
      emoji,
      status: ACTION_STATUS.REQUESTED,
      timestamp: Date.now(),
      verified: false,
    };

    const conn = this._checkConnection();
    if (!conn.ok) {
      action.status = ACTION_STATUS.FAILED;
      action.error = conn.reason;
      this._logAction(action);
      return action;
    }

    try {
      action.status = ACTION_STATUS.EXECUTING;
      await this.sock.sendMessage(chatJid, { react: { text: emoji, key: messageKey } });
      action.status = ACTION_STATUS.SUCCESS;
      action.verified = true;
    } catch (e) {
      action.status = ACTION_STATUS.FAILED;
      action.error = e.message;
    }

    this._logAction(action);
    return action;
  }

  /**
   * Marquer un message comme lu
   */
  async markRead(messageKeys) {
    const action = {
      type: 'MARK_READ',
      count: messageKeys?.length || 0,
      status: ACTION_STATUS.REQUESTED,
      timestamp: Date.now(),
      verified: false,
    };

    const conn = this._checkConnection();
    if (!conn.ok) {
      action.status = ACTION_STATUS.FAILED;
      action.error = conn.reason;
      this._logAction(action);
      return action;
    }

    try {
      action.status = ACTION_STATUS.EXECUTING;
      await this.sock.readMessages(messageKeys);
      action.status = ACTION_STATUS.SUCCESS;
      action.verified = true;
    } catch (e) {
      action.status = ACTION_STATUS.FAILED;
      action.error = e.message;
    }

    this._logAction(action);
    return action;
  }

  /**
   * Obtenir les stats
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Obtenir le log des actions
   */
  getActionLog(limit = 50) {
    return this.actionLog.slice(0, limit);
  }
}

let instance = null;
function getActionEngine(sock) {
  if (!instance) instance = new ActionEngine(sock);
  if (sock) instance.setSocket(sock);
  return instance;
}

module.exports = { getActionEngine, ACTION_STATUS };
