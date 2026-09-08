import { rawRun, rawGet, rawAll } from '../../packages/infrastructure/database/database.js';
import { getSecureLogger } from '../utils/secure-logger.js';

const logger = getSecureLogger();

const db = { run: rawRun, get: rawGet, all: rawAll };

class DeviceManager {
    constructor(socket = null) {
        this.socket = socket;
        this.deviceCache = new Map();
    }

    setSocket(socket) {
        this.socket = socket;
    }

    async registerDevice(userJid, deviceId, deviceName, deviceType, metadata = {}) {
        try {
            const now = new Date().toISOString();
            const ipAddress = metadata.ipAddress || null;
            const userAgent = metadata.userAgent || null;

            await db.run(
                `INSERT INTO appareils_connus (user_jid, device_id, device_name, device_type, ip_address, user_agent, first_seen, last_used, is_trusted, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(user_jid, device_id) DO UPDATE SET
                 last_used = excluded.last_used, is_active = 1`,
                [userJid, deviceId, deviceName || 'Unknown Device', deviceType || 'unknown', ipAddress, userAgent, now, now, 1, 1]
            );

            await this.notifyNewDevice(userJid, deviceId, deviceName);

            this.deviceCache.set(`${userJid}:${deviceId}`, { deviceId, deviceName, deviceType, firstSeen: now, lastUsed: now, isTrusted: true });

            logger.info(`Appareil enregistré pour ${userJid}`, { deviceId, deviceName, deviceType });
            return { success: true };
        } catch (error) {
            logger.error('Erreur lors de l\'enregistrement de l\'appareil', { error: error.message, userJid, deviceId });
            return { success: false, error: error.message };
        }
    }

    async getUserDevices(userJid) {
        try {
            const devices = await db.all(
                `SELECT * FROM appareils_connus WHERE user_jid = ? AND is_active = 1 ORDER BY last_used DESC`,
                [userJid]
            );
            return { success: true, devices };
        } catch (error) {
            logger.error('Erreur lors de la récupération des appareils', { error: error.message, userJid });
            return { success: false, error: error.message };
        }
    }

    async isDeviceAuthorized(userJid, deviceId) {
        try {
            const device = await db.get(
                `SELECT * FROM appareils_connus WHERE user_jid = ? AND device_id = ? AND is_active = 1 AND is_trusted = 1`,
                [userJid, deviceId]
            );

            if (device) {
                await db.run(`UPDATE appareils_connus SET last_used = datetime('now') WHERE user_jid = ? AND device_id = ?`, [userJid, deviceId]);
                return { authorized: true, device };
            }

            return { authorized: false };
        } catch (error) {
            logger.error('Erreur lors de la vérification de l\'appareil', { error: error.message, userJid, deviceId });
            return { authorized: false, error: error.message };
        }
    }

    async disconnectDevice(userJid, deviceId, reason = 'user_requested') {
        try {
            await db.run(
                `UPDATE appareils_connus SET is_active = 0, is_trusted = 0 WHERE user_jid = ? AND device_id = ?`,
                [userJid, deviceId]
            );

            if (this.socket && this.socket.removeDevice) {
                try {
                    await this.socket.removeDevice(deviceId);
                } catch (socketError) {
                    logger.warn('Erreur lors de la déconnexion via Baileys', { error: socketError.message, deviceId });
                }
            }

            this.deviceCache.delete(`${userJid}:${deviceId}`);
            logger.info(`Appareil déconnecté pour ${userJid}`, { deviceId, reason });
            return { success: true };
        } catch (error) {
            logger.error('Erreur lors de la déconnexion de l\'appareil', { error: error.message, userJid, deviceId });
            return { success: false, error: error.message };
        }
    }

    async disconnectAllDevicesExcept(userJid, keepDeviceId) {
        try {
            const result = await db.run(
                `UPDATE appareils_connus SET is_active = 0, is_trusted = 0 WHERE user_jid = ? AND device_id != ? AND is_active = 1`,
                [userJid, keepDeviceId]
            );

            for (const key of this.deviceCache.keys()) {
                if (key.startsWith(`${userJid}:`) && !key.includes(keepDeviceId)) {
                    this.deviceCache.delete(key);
                }
            }

            logger.info(`Tous les appareils déconnectés sauf un pour ${userJid}`, { keepDeviceId });
            return { success: true };
        } catch (error) {
            logger.error('Erreur lors de la déconnexion des appareils', { error: error.message, userJid });
            return { success: false, error: error.message };
        }
    }

    async notifyNewDevice(userJid, deviceId, deviceName) {
        try {
            logger.security(`\u{1F510} Nouvel appareil détecté pour ${userJid}`, { deviceId, deviceName, action: 'notify_user' });

            if (this.socket && this.socket.sendMessage) {
                try {
                    const message = `\u{1F510} *Nouvel appareil détecté*\n\n` +
                        `Un nouvel appareil s'est connecté à votre compte WhatsApp.\n` +
                        `\u{1F4F1} Appareil: ${deviceName || 'Inconnu'}\n` +
                        `\u{1F194} ID: ${deviceId.substring(0, 12)}...\n\n` +
                        `Si vous ne reconnaissez pas cet appareil, veuillez le déconnecter immédiatement depuis vos paramètres.`;

                    await this.socket.sendMessage(userJid, { text: message });
                } catch (sendError) {
                    logger.warn('Impossible d\'envoyer la notification', { error: sendError.message, userJid });
                }
            }
        } catch (error) {
            logger.error('Erreur lors de la notification', { error: error.message, userJid });
        }
    }

    async detectNewDevice(userJid, deviceId, deviceInfo = {}) {
        const check = await this.isDeviceAuthorized(userJid, deviceId);

        if (!check.authorized) {
            const deviceName = deviceInfo.name || 'Nouvel appareil';
            const deviceType = deviceInfo.type || 'unknown';

            await this.registerDevice(userJid, deviceId, deviceName, deviceType, {
                ipAddress: deviceInfo.ipAddress,
                userAgent: deviceInfo.userAgent
            });

            return { isNew: true, deviceId, deviceName, action: 'registered' };
        }

        return { isNew: false, device: check.device };
    }

    async getDeviceStats() {
        try {
            const total = await db.get('SELECT COUNT(*) as count FROM appareils_connus WHERE is_active = 1');
            const byType = await db.all(`SELECT device_type, COUNT(*) as count FROM appareils_connus WHERE is_active = 1 GROUP BY device_type`);
            const recent = await db.all(`SELECT user_jid, device_name, last_used FROM appareils_connus WHERE is_active = 1 ORDER BY last_used DESC LIMIT 10`);

            return { success: true, stats: { total: total?.count || 0, byType, recent } };
        } catch (error) {
            logger.error('Erreur lors de la récupération des statistiques', { error: error.message });
            return { success: false, error: error.message };
        }
    }
}

let instance = null;

export function getDeviceManager(socket = null) {
    if (!instance) {
        instance = new DeviceManager(socket);
    }
    if (socket) {
        instance.setSocket(socket);
    }
    return instance;
}

/* Wrapper fonctionnel attendu par src/api/webhook.js (GET /devices/:jid). */
export async function listDevices(userJid) {
    return getDeviceManager().getUserDevices(userJid);
}

export default DeviceManager;
