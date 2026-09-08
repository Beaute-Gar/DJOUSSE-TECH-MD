/**
 * Guardian Agent — DJOUSSE-TECH-MD
 * 
 * Agent de surveillance permanent qui observe les événements WhatsApp
 * et détermine l'action appropriée.
 * 
 * Décisions: IGNORE | ANALYZE | RESPOND | WARN | MODERATE | ALERT_ADMIN
 */

const { getAuditLog } = require('./audit-log.cjs');
const { verifyMessageLinks } = require('../middleware/link-checker.cjs');

const DECISIONS = {
  IGNORE: 'IGNORE',
  ANALYZE: 'ANALYZE',
  RESPOND: 'RESPOND',
  WARN: 'WARN',
  MODERATE: 'MODERATE',
  ALERT_ADMIN: 'ALERT_ADMIN',
};

class GuardianAgent {
  constructor() {
    this.auditLog = getAuditLog();
    this.activeChats = new Set();       // Chats où le guardian est actif
    this.adminJids = new Set();         // Admins à notifier
    this.stats = {
      messagesProcessed: 0,
      ignored: 0,
      analyzed: 0,
      responded: 0,
      warned: 0,
      moderated: 0,
      alertsSent: 0,
    };
    this.cooldowns = new Map();         // Anti-flood: { chatJid: lastAction }
    this.cooldownMs = 5000;             // 5s entre actions par chat
    this.relevanceThreshold = 0.6;      // Seuil pour répondre
    this.spamThreshold = 3;             // Messages en 10s = spam
    this.spamWindow = 10000;            // 10s
    this.messageCounts = new Map();     // { chatJid: [timestamps] }
  }

  /**
   * Configurer les admins
   */
  configureAdmins(adminJids) {
    this.adminJids = new Set(adminJids);
  }

  /**
   * Activer le guardian pour un chat
   */
  activateForChat(chatJid) {
    this.activeChats.add(chatJid);
  }

  /**
   * Désactiver le guardian pour un chat
   */
  deactivateForChat(chatJid) {
    this.activeChats.delete(chatJid);
  }

  /**
   * Analyser un message et décider de l'action
   */
  async analyze(msg, m) {
    const chatJid = m?.chat || msg?.key?.remoteJid;
    const sender = m?.sender || msg?.key?.participant || chatJid;
    const body = m?.body || '';
    const isGroup = chatJid?.endsWith('@g.us') || false;
    const isFromMe = msg?.key?.fromMe || false;

    this.stats.messagesProcessed++;

    // Ignorer les messages du bot (sauf les commandes de l'owner et les clics boutons/menu)
    const isCmd = body && typeof body === 'string' && body.startsWith('.');
    const hasInteractive = !!(msg?.message?.interactiveResponseMessage || msg?.message?.listResponseMessage || msg?.message?.buttonsResponseMessage);
    if (isFromMe && !isCmd && !hasInteractive) return { decision: DECISIONS.IGNORE, reason: 'Message du bot' };

    // Ignorer les statuts
    if (chatJid === 'status@broadcast') return { decision: DECISIONS.IGNORE, reason: 'Statut' };

    // Vérifier cooldown anti-flood du bot
    if (this._isOnCooldown(chatJid)) {
      return { decision: DECISIONS.IGNORE, reason: 'Cooldown actif' };
    }

    // Détecter spam (flood)
    const spamResult = this._checkSpam(chatJid, sender);
    if (spamResult.isSpam) {
      this.stats.warned++;
      this.auditLog.logSpam(chatJid, sender, spamResult.reason, spamResult.score);
      return { decision: DECISIONS.MODERATE, reason: spamResult.reason, type: 'spam', score: spamResult.score };
    }

    // Vérifier les liens
    if (body && /https?:\/\//i.test(body)) {
      const linkResult = verifyMessageLinks(body, chatJid);
      if (linkResult.overallClassification === 'MALICIOUS') {
        this.stats.moderated++;
        this.auditLog.logLinkCheck(chatJid, sender, body, 'MALICIOUS');
        return { decision: DECISIONS.MODERATE, reason: 'Lien malveillant', type: 'malicious_link', classification: linkResult };
      }
      if (linkResult.overallClassification === 'SUSPICIOUS') {
        this.auditLog.logLinkCheck(chatJid, sender, body, 'SUSPICIOUS');
        return { decision: DECISIONS.WARN, reason: 'Lien suspect', type: 'suspicious_link', classification: linkResult };
      }
    }

    // Messages normaux en groupe → analyser si le guardian est actif
    if (isGroup && this.activeChats.has(chatJid)) {
      this.stats.analyzed++;
      return { decision: DECISIONS.ANALYZE, reason: 'Message de groupe à analyser' };
    }

    // DM → toujours analyser
    if (!isGroup) {
      this.stats.analyzed++;
      return { decision: DECISIONS.ANALYZE, reason: 'Message privé' };
    }

    this.stats.ignored++;
    return { decision: DECISIONS.IGNORE, reason: 'Groupe non actif' };
  }

  /**
   * Vérifier si un chat est en cooldown
   */
  _isOnCooldown(chatJid) {
    const last = this.cooldowns.get(chatJid) || 0;
    return Date.now() - last < this.cooldownMs;
  }

  /**
   * Mettre à jour le cooldown
   */
  _setCooldown(chatJid) {
    this.cooldowns.set(chatJid, Date.now());
  }

  /**
   * Détecter le spam (flood)
   */
  _checkSpam(chatJid, sender) {
    const key = `${chatJid}:${sender}`;
    const now = Date.now();
    
    if (!this.messageCounts.has(key)) this.messageCounts.set(key, []);
    const timestamps = this.messageCounts.get(key);
    
    // Nettoyer les anciens timestamps
    while (timestamps.length > 0 && timestamps[0] < now - this.spamWindow) {
      timestamps.shift();
    }
    
    timestamps.push(now);
    
    if (timestamps.length >= this.spamThreshold) {
      return {
        isSpam: true,
        reason: `${timestamps.length} messages en ${Math.round(this.spamWindow / 1000)}s`,
        score: Math.min(100, timestamps.length * 20),
      };
    }
    
    return { isSpam: false };
  }

  /**
   * Obtenir les stats
   */
  getStats() {
    return { ...this.stats };
  }
}

let instance = null;
function getGuardianAgent() {
  if (!instance) instance = new GuardianAgent();
  return instance;
}

module.exports = { getGuardianAgent, DECISIONS };
