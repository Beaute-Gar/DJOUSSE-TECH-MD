import { rawRun, rawGet, rawAll } from '../../packages/infrastructure/database/database.js';
import { getSecureLogger } from '../utils/secure-logger.js';

const logger = getSecureLogger();

const db = { run: rawRun, get: rawGet, all: rawAll };

class AnomalyDetector {
    constructor() {
        this.userStats = new Map();
        this.ipStats = new Map();
        this.messageHistory = new Map();
        this.globalStats = {
            totalMessages: 0,
            messagesPerSecond: 0,
            lastReset: Date.now()
        };

        this.config = {
            maxMessagesPerMinute: 30,
            maxMessagesPerHour: 100,
            maxMessagesPerDay: 500,
            maxIpMessagesPerMinute: 50,
            similarityThreshold: 0.8,
            burstThreshold: 10,
            anomalyWindow: 300000,
            alertCooldown: 3600000
        };

        this.alertHistory = new Map();
    }

    async detectAnomaly(message, userJid, ipAddress = null) {
        try {
            const timestamp = Date.now();

            this.updateStats(userJid, ipAddress, timestamp);

            const anomalies = [];

            const rateAnomaly = this.checkMessageRate(userJid, timestamp);
            if (rateAnomaly) anomalies.push(rateAnomaly);

            if (ipAddress) {
                const ipAnomaly = this.checkIpActivity(ipAddress, timestamp);
                if (ipAnomaly) anomalies.push(ipAnomaly);
            }

            const similarityAnomaly = await this.checkSimilarity(message, userJid);
            if (similarityAnomaly) anomalies.push(similarityAnomaly);

            const burstAnomaly = this.checkBurst(userJid, timestamp);
            if (burstAnomaly) anomalies.push(burstAnomaly);

            const behaviorAnomaly = await this.checkBehaviorChange(userJid, message);
            if (behaviorAnomaly) anomalies.push(behaviorAnomaly);

            if (anomalies.length > 0) {
                const severity = this.calculateSeverity(anomalies);
                const result = {
                    hasAnomaly: true,
                    anomalies,
                    severity,
                    action: this.determineAction(severity, anomalies)
                };

                await this.logAnomaly(userJid, anomalies, severity, ipAddress);
                await this.alertIfNeeded(userJid, anomalies, severity);

                return result;
            }

            return { hasAnomaly: false, anomalies: [], severity: 0, action: 'allow' };
        } catch (error) {
            logger.error('Erreur lors de la détection d\'anomalie', { error: error.message, userJid });
            return { hasAnomaly: false, anomalies: [], severity: 0, action: 'allow', error: error.message };
        }
    }

    checkMessageRate(userJid, timestamp) {
        const stats = this.userStats.get(userJid);
        if (!stats) return null;

        const minuteAgo = timestamp - 60000;
        const hourAgo = timestamp - 3600000;
        const dayAgo = timestamp - 86400000;

        const messagesLastMinute = stats.messages.filter(t => t > minuteAgo);
        const messagesLastHour = stats.messages.filter(t => t > hourAgo);
        const messagesLastDay = stats.messages.filter(t => t > dayAgo);

        if (messagesLastMinute.length > this.config.maxMessagesPerMinute) {
            return { type: 'rate_exceeded', subType: 'per_minute', count: messagesLastMinute.length, limit: this.config.maxMessagesPerMinute, severity: 3, description: `Trop de messages par minute: ${messagesLastMinute.length}` };
        }
        if (messagesLastHour.length > this.config.maxMessagesPerHour) {
            return { type: 'rate_exceeded', subType: 'per_hour', count: messagesLastHour.length, limit: this.config.maxMessagesPerHour, severity: 3, description: `Trop de messages par heure: ${messagesLastHour.length}` };
        }
        if (messagesLastDay.length > this.config.maxMessagesPerDay) {
            return { type: 'rate_exceeded', subType: 'per_day', count: messagesLastDay.length, limit: this.config.maxMessagesPerDay, severity: 2, description: `Trop de messages par jour: ${messagesLastDay.length}` };
        }

        return null;
    }

    checkIpActivity(ipAddress, timestamp) {
        const stats = this.ipStats.get(ipAddress);
        if (!stats) return null;

        const minuteAgo = timestamp - 60000;
        const messagesLastMinute = stats.messages.filter(t => t > minuteAgo);

        if (messagesLastMinute.length > this.config.maxIpMessagesPerMinute) {
            return { type: 'ip_rate_exceeded', subType: 'per_minute', count: messagesLastMinute.length, limit: this.config.maxIpMessagesPerMinute, severity: 2, description: `Trop de messages depuis la même IP: ${messagesLastMinute.length}` };
        }

        return null;
    }

    async checkSimilarity(message, userJid) {
        if (!message || !message.text) return null;

        const recentMessages = this.getRecentMessages(userJid, 10);
        if (recentMessages.length === 0) return null;

        const similarCount = recentMessages.filter(msg =>
            this.calculateSimilarity(message.text, msg.text) > this.config.similarityThreshold
        ).length;

        if (similarCount > 5) {
            return { type: 'coordinated_spam', subType: 'similar_messages', count: similarCount, threshold: this.config.similarityThreshold, severity: 4, description: `Spam coordonné détecté: ${similarCount} messages similaires` };
        }

        return null;
    }

    checkBurst(userJid, timestamp) {
        const stats = this.userStats.get(userJid);
        if (!stats) return null;

        const windowStart = timestamp - this.config.anomalyWindow;
        const messagesInWindow = stats.messages.filter(t => t > windowStart);

        if (messagesInWindow.length > this.config.burstThreshold) {
            return { type: 'burst_detected', subType: 'message_burst', count: messagesInWindow.length, threshold: this.config.burstThreshold, severity: 3, description: `Rafale de messages: ${messagesInWindow.length} en ${this.config.anomalyWindow/1000}s` };
        }

        return null;
    }

    async checkBehaviorChange(userJid, message) {
        return null;
    }

    calculateSeverity(anomalies) {
        if (anomalies.length === 0) return 0;
        const maxSeverity = Math.max(...anomalies.map(a => a.severity));
        const avgSeverity = anomalies.reduce((sum, a) => sum + a.severity, 0) / anomalies.length;
        return Math.min(4, Math.round(maxSeverity * 0.6 + avgSeverity * 0.4));
    }

    determineAction(severity, anomalies) {
        if (severity >= 4) return 'block';
        if (severity >= 3) return 'warn';
        if (severity >= 2) return 'monitor';
        return 'allow';
    }

    updateStats(userJid, ipAddress, timestamp) {
        this.globalStats.totalMessages++;

        if (!this.userStats.has(userJid)) {
            this.userStats.set(userJid, { messages: [], firstSeen: timestamp, lastSeen: timestamp, totalMessages: 0 });
        }
        const userStats = this.userStats.get(userJid);
        userStats.messages.push(timestamp);
        userStats.totalMessages++;
        userStats.lastSeen = timestamp;

        const cutoff = timestamp - 86400000;
        userStats.messages = userStats.messages.filter(t => t > cutoff);

        if (ipAddress) {
            if (!this.ipStats.has(ipAddress)) {
                this.ipStats.set(ipAddress, { messages: [], firstSeen: timestamp, lastSeen: timestamp, totalMessages: 0 });
            }
            const ipStats = this.ipStats.get(ipAddress);
            ipStats.messages.push(timestamp);
            ipStats.totalMessages++;
            ipStats.lastSeen = timestamp;

            const ipCutoff = timestamp - 3600000;
            ipStats.messages = ipStats.messages.filter(t => t > ipCutoff);
        }
    }

    getRecentMessages(userJid, limit = 10) {
        const stats = this.userStats.get(userJid);
        if (!stats) return [];
        return [];
    }

    calculateSimilarity(text1, text2) {
        const words1 = text1.toLowerCase().split(/\s+/);
        const words2 = text2.toLowerCase().split(/\s+/);
        const common = words1.filter(word => words2.includes(word));
        const total = new Set([...words1, ...words2]).size;
        return common.length / total;
    }

    async logAnomaly(userJid, anomalies, severity, ipAddress) {
        try {
            const now = new Date().toISOString();
            const anomalyTypes = anomalies.map(a => a.type).join(',');

            await db.run(
                `INSERT INTO alertes_anomalies (user_jid, anomaly_type, severity, description, detected_at, metadata)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [userJid, anomalyTypes.substring(0, 100), severity, anomalies.map(a => a.description).join('; '), now, JSON.stringify({ anomalies, ipAddress, totalAnomalies: anomalies.length })]
            );

            logger.security(`Anomalie détectée pour ${userJid}`, { severity, types: anomalyTypes, count: anomalies.length });
        } catch (error) {
            logger.error('Erreur lors du logging de l\'anomalie', { error: error.message, userJid });
        }
    }

    async alertIfNeeded(userJid, anomalies, severity) {
        const cooldownKey = `${userJid}_${severity}`;
        const lastAlert = this.alertHistory.get(cooldownKey) || 0;
        const now = Date.now();

        if (now - lastAlert < this.config.alertCooldown) return;

        logger.security(`⚠️ ALERTE: Anomalie sévère pour ${userJid}`, { severity, anomalies: anomalies.map(a => a.description), action: this.determineAction(severity, anomalies) });

        this.alertHistory.set(cooldownKey, now);
    }

    cleanOldStats() {
        const now = Date.now();
        const dayAgo = now - 86400000;

        for (const [userJid, stats] of this.userStats) {
            stats.messages = stats.messages.filter(t => t > dayAgo);
            if (stats.messages.length === 0 && stats.totalMessages === 0) {
                this.userStats.delete(userJid);
            }
        }

        const hourAgo = now - 3600000;
        for (const [ip, stats] of this.ipStats) {
            stats.messages = stats.messages.filter(t => t > hourAgo);
            if (stats.messages.length === 0 && stats.totalMessages === 0) {
                this.ipStats.delete(ip);
            }
        }
    }

    getStats() {
        return { userStats: this.userStats.size, ipStats: this.ipStats.size, globalMessages: this.globalStats.totalMessages, alertHistory: this.alertHistory.size };
    }

    /* Liste les alertes non résolues — utilisé par le dashboard/webhook (GET /alerts). */
    async getActiveAlerts() {
        try {
            return await db.all(
                `SELECT * FROM alertes_anomalies WHERE resolved = 0 ORDER BY detected_at DESC LIMIT 200`
            );
        } catch (error) {
            logger.error('Erreur lors de la récupération des alertes actives', { error: error.message });
            return [];
        }
    }

    /* Marque une alerte comme résolue — utilisé par le webhook (POST /alerts/:id/resolve). */
    async resolveAnomaly(alertId) {
        try {
            const now = new Date().toISOString();
            await db.run(
                `UPDATE alertes_anomalies SET resolved = 1, resolved_at = ? WHERE id = ?`,
                [now, alertId]
            );
            return { success: true };
        } catch (error) {
            logger.error('Erreur lors de la résolution de l\'anomalie', { error: error.message, alertId });
            return { success: false, error: error.message };
        }
    }
}

let instance = null;

export function getAnomalyDetector() {
    if (!instance) {
        instance = new AnomalyDetector();
        setInterval(() => instance.cleanOldStats(), 60000);
    }
    return instance;
}

/* Wrappers fonctionnels attendus par src/api/webhook.js — délèguent au singleton. */
export async function getActiveAlerts() {
    return getAnomalyDetector().getActiveAlerts();
}

export async function resolveAnomaly(alertId) {
    return getAnomalyDetector().resolveAnomaly(alertId);
}

export default AnomalyDetector;
