/**
 * Proactive Moderation — DJOUSSE-TECH-MD v3.0
 * 
 * Modération automatique avec détection ML :
 * - Spam detection (fréquence + contenu)
 * - Harcèlement (mots-clés + patterns)
 * - Liens dangereux (URL blacklist)
 * - Flood protection
 * - Warn système (3 warnings = kick)
 * - Audit log
 * 
 * Compatible CJS.
 */

/* ═══════════════════════════════════════════════════════════════════
   CONFIGURATION
   ═══════════════════════════════════════════════════════════════════ */
const MOD_CONFIG = {
    ENABLED: process.env.MODERATION_ENABLED === 'true',
    MAX_MESSAGES_PER_MINUTE: 10,
    MAX_WARNINGS: 3,
    SPAM_COOLDOWN: 300000,     // 5min entre warnings
    LINK_WHITELIST: [
        'youtube.com', 'youtu.be', 'instagram.com', 'tiktok.com',
        'twitter.com', 'x.com', 'facebook.com', 'wa.me',
        'github.com', 'google.com', 'discord.gg',
    ],
    BLACKLIST_PATTERNS: [
        /bit\.ly/i, /tinyurl\.com/i, /t\.co/i, /short\.io/i,
        /\.exe$/i, /\.apk$/i, /\.bat$/i, /\.cmd$/i,
    ],
    HARASSMENT_KEYWORDS: [
        // Basique - à personnaliser selon la communauté
        /connard|enculé|salope?|fdp|ntm|nique|ta\s+mère/i,
        /va\s+mourir|suicide|bâtard|crétin|idiot\s+utile/i,
    ],
    WARN_EXPIRY: 7 * 24 * 3600000,  // 7 jours
};

/* ═══════════════════════════════════════════════════════════════════
   CLASSE MODERATION MANAGER
   ═══════════════════════════════════════════════════════════════════ */
class ProactiveModeration {
    constructor() {
        this.warnings = new Map();  // groupId:userId -> { count, lastWarn, reasons }
        this.messageCounts = new Map();  // groupId:userId -> { count, windowStart }
        this.auditLog = [];
        this.enabled = MOD_CONFIG.ENABLED;
    }

    /**
     * Analyser un message
     * @returns {{ action: 'allow'|'warn'|'mute'|'kick'|'ban', reason?: string }}
     */
    async inspect(sock, msg, m) {
        if (!this.enabled) return { action: 'allow' };

        const groupId = m.chat;
        const userId = m.sender;

        // Ignorer les non-groupes
        if (!groupId?.endsWith('@g.us')) return { action: 'allow' };

        // Ignorer le bot lui-même
        if (msg.key?.fromMe) return { action: 'allow' };

        // Ignorer les admins
        if (await this.isAdmin(sock, groupId, userId)) return { action: 'allow' };

        // 1. Vérifier le flood
        const floodCheck = this.checkFlood(groupId, userId);
        if (floodCheck.action !== 'allow') return floodCheck;

        // 2. Vérifier les liens
        const linkCheck = this.checkLinks(m.body);
        if (linkCheck.action !== 'allow') return linkCheck;

        // 3. Vérifier le harcèlement
        const harassCheck = this.checkHarassment(m.body);
        if (harassCheck.action !== 'allow') return harassCheck;

        return { action: 'allow' };
    }

    /**
     * Détection de flood
     */
    checkFlood(groupId, userId) {
        const key = `${groupId}:${userId}`;
        const now = Date.now();

        if (!this.messageCounts.has(key)) {
            this.messageCounts.set(key, { count: 1, windowStart: now });
            return { action: 'allow' };
        }

        const data = this.messageCounts.get(key);
        
        // Reset window après 60s
        if (now - data.windowStart > 60000) {
            data.count = 1;
            data.windowStart = now;
            return { action: 'allow' };
        }

        data.count++;

        if (data.count > MOD_CONFIG.MAX_MESSAGES_PER_MINUTE) {
            this.logAudit('flood', groupId, userId, { count: data.count });
            return { 
                action: 'warn', 
                reason: `Flood détecté (${data.count} messages/min)` 
            };
        }

        return { action: 'allow' };
    }

    /**
     * Vérification des liens
     */
    checkLinks(text) {
        if (!text) return { action: 'allow' };

        const urlRegex = /https?:\/\/[^\s]+/gi;
        const urls = text.match(urlRegex) || [];

        for (const url of urls) {
            // Vérifier la blacklist
            for (const pattern of MOD_CONFIG.BLACKLIST_PATTERNS) {
                if (pattern.test(url)) {
                    this.logAudit('blacklist_link', null, null, { url });
                    return { 
                        action: 'warn', 
                        reason: `Lien interdit détecté` 
                    };
                }
            }

            // Vérifier whitelist
            const isWhitelisted = MOD_CONFIG.LINK_WHITELIST.some(domain => 
                url.toLowerCase().includes(domain)
            );

            if (!isWhitelisted && urls.length > 0) {
                // Lien non-whitelisté = suspect
                return { 
                    action: 'warn', 
                    reason: `Lien non autorisé` 
                };
            }
        }

        return { action: 'allow' };
    }

    /**
     * Détection de harcèlement
     */
    checkHarassment(text) {
        if (!text) return { action: 'allow' };

        for (const pattern of MOD_CONFIG.HARASSMENT_KEYWORDS) {
            if (pattern.test(text)) {
                this.logAudit('harassment', null, null, { text: text.slice(0, 100) });
                return { 
                    action: 'warn', 
                    reason: `Contenu inapproprié détecté` 
                };
            }
        }

        return { action: 'allow' };
    }

    /**
     * Ajouter un warning
     */
    addWarning(groupId, userId, reason) {
        const key = `${groupId}:${userId}`;
        const now = Date.now();

        if (!this.warnings.has(key)) {
            this.warnings.set(key, { count: 0, lastWarn: 0, reasons: [] });
        }

        const data = this.warnings.get(key);

        // Reset si > 7 jours
        if (now - data.lastWarn > MOD_CONFIG.WARN_EXPIRY) {
            data.count = 0;
            data.reasons = [];
        }

        data.count++;
        data.lastWarn = now;
        data.reasons.push({ reason, time: now });

        this.logAudit('warning', groupId, userId, { count: data.count, reason });

        return {
            count: data.count,
            shouldKick: data.count >= MOD_CONFIG.MAX_WARNINGS,
        };
    }

    /**
     * Obtenir les warnings d'un utilisateur
     */
    getWarnings(groupId, userId) {
        const key = `${groupId}:${userId}`;
        const data = this.warnings.get(key);
        if (!data) return { count: 0, reasons: [] };
        
        // Vérifier expiry
        if (Date.now() - data.lastWarn > MOD_CONFIG.WARN_EXPIRY) {
            this.warnings.delete(key);
            return { count: 0, reasons: [] };
        }
        
        return data;
    }

    /**
     * Vérifier si un utilisateur est admin
     */
    async isAdmin(sock, groupId, userId) {
        try {
            const groupMeta = await sock.groupMetadata(groupId);
            const admins = groupMeta.participants
                .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                .map(p => p.id);
            return admins.includes(userId);
        } catch {
            return false;
        }
    }

    /**
     * Audit log
     */
    logAudit(event, groupId, userId, data = {}) {
        this.auditLog.push({
            time: new Date().toISOString(),
            event,
            groupId,
            userId,
            ...data,
        });

        if (this.auditLog.length > 1000) this.auditLog.shift();

        console.log(`[MOD] ${event}: ${userId || 'system'} in ${groupId || 'global'}`);
    }

    /**
     * Obtenir les logs d'audit
     */
    getAuditLog(limit = 50) {
        return this.auditLog.slice(-limit);
    }

    /**
     * Activer/Désactiver
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`[MOD] Modération ${enabled ? 'activée' : 'désactivée'}`);
    }
}

/* ═══════════════════════════════════════════════════════════════════
   INSTANCE SINGLETON
   ═══════════════════════════════════════════════════════════════════ */
let instance = null;

function getModeration() {
    if (!instance) instance = new ProactiveModeration();
    return instance;
}

module.exports = {
    getModeration,
    ProactiveModeration,
    MOD_CONFIG,
};
