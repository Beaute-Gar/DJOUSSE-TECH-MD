/**
 * Audit Log — DJOUSSE-TECH-MD
 * 
 * Journal complet de toutes les actions du bot.
 * Chaque opération importante est enregistrée avec: timestamp, event, chatId, 
 * messageId, sender, analysis, decision, action, status, error.
 */

const fs = require('fs');
const path = require('path');

class AuditLog {
  constructor() {
    this.logFile = path.join(__dirname, '..', '..', 'data', 'audit-log.jsonl');
    this.memoryLog = [];
    this.maxMemory = 200;
    this.stats = {
      totalEvents: 0,
      messagesReceived: 0,
      messagesSent: 0,
      commandsExecuted: 0,
      spamDetected: 0,
      scamDetected: 0,
      linksChecked: 0,
      moderationActions: 0,
      errorsLogged: 0,
    };
    this._ensureDir();
  }

  _ensureDir() {
    try {
      const dir = path.dirname(this.logFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }

  /**
   * Enregistrer un événement
   */
  log(entry) {
    const record = {
      timestamp: new Date().toISOString(),
      ts: Date.now(),
      ...entry,
    };

    // En mémoire
    this.memoryLog.unshift(record);
    if (this.memoryLog.length > this.maxMemory) this.memoryLog.pop();

    // Mettre à jour les stats
    this.stats.totalEvents++;
    if (entry.event === 'MESSAGE_RECEIVED') this.stats.messagesReceived++;
    if (entry.event === 'MESSAGE_SENT') this.stats.messagesSent++;
    if (entry.event === 'COMMAND_EXECUTED') this.stats.commandsExecuted++;
    if (entry.event === 'SPAM_DETECTED') this.stats.spamDetected++;
    if (entry.event === 'SCAM_DETECTED') this.stats.scamDetected++;
    if (entry.event === 'LINK_CHECKED') this.stats.linksChecked++;
    if (entry.event.startsWith('MODERATION_')) this.stats.moderationActions++;
    if (entry.event === 'ERROR') this.stats.errorsLogged++;

    // Sur disque (append JSONL)
    try {
      fs.appendFileSync(this.logFile, JSON.stringify(record) + '\n');
    } catch {}
  }

  /**
   * Log message reçu
   */
  logMessageReceived(chatId, messageId, sender, body, isGroup) {
    this.log({
      event: 'MESSAGE_RECEIVED',
      chatId,
      messageId,
      sender,
      bodyPreview: (body || '').slice(0, 100),
      isGroup,
    });
  }

  /**
   * Log message envoyé
   */
  logMessageSent(chatId, messageId, text) {
    this.log({
      event: 'MESSAGE_SENT',
      chatId,
      messageId,
      textPreview: (text || '').slice(0, 100),
    });
  }

  /**
   * Log commande exécutée
   */
  logCommand(chatId, messageId, sender, command, status) {
    this.log({
      event: 'COMMAND_EXECUTED',
      chatId,
      messageId,
      sender,
      command,
      status,
    });
  }

  /**
   * Log action de modération
   */
  logModeration(chatId, sender, action, reason, status) {
    this.log({
      event: `MODERATION_${action}`,
      chatId,
      sender,
      action,
      reason,
      status,
    });
  }

  /**
   * Log détection spam
   */
  logSpam(chatId, sender, reason, score) {
    this.log({
      event: 'SPAM_DETECTED',
      chatId,
      sender,
      reason,
      riskScore: score,
    });
  }

  /**
   * Log détection scam
   */
  logScam(chatId, sender, reason, details) {
    this.log({
      event: 'SCAM_DETECTED',
      chatId,
      sender,
      reason,
      details,
    });
  }

  /**
   * Log vérification lien
   */
  logLinkCheck(chatId, sender, url, classification) {
    this.log({
      event: 'LINK_CHECKED',
      chatId,
      sender,
      url,
      classification,
    });
  }

  /**
   * Log erreur
   */
  logError(context, error) {
    this.log({
      event: 'ERROR',
      context,
      error: error?.message || String(error),
      stack: error?.stack?.slice(0, 500),
    });
  }

  /**
   * Log connexion
   */
  logConnection(state, details) {
    this.log({
      event: 'CONNECTION_STATE_CHANGE',
      state,
      details,
    });
  }

  /**
   * Obtenir les logs mémoire
   */
  getRecent(limit = 100) {
    return this.memoryLog.slice(0, limit);
  }

  /**
   * Obtenir les stats
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Lire le fichier JSONL
   */
  readLogFile(lines = 100) {
    try {
      if (!fs.existsSync(this.logFile)) return [];
      const content = fs.readFileSync(this.logFile, 'utf8');
      const allLines = content.trim().split('\n').filter(Boolean);
      return allLines.slice(-lines).map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
    } catch { return []; }
  }
}

let instance = null;
function getAuditLog() {
  if (!instance) instance = new AuditLog();
  return instance;
}

module.exports = { getAuditLog };
