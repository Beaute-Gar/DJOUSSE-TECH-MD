import { rawRun, rawGet, rawAll } from '../../packages/infrastructure/database/database.js';
import { getSecureLogger } from '../utils/secure-logger.js';

const logger = getSecureLogger();

const db = { run: rawRun, get: rawGet, all: rawAll };

class ComplianceManager {
    constructor() {
        this.consentExpiryDays = 365;
        this.version = '1.0';
    }

    async checkConsent(userJid, consentType = 'data_processing') {
        try {
            const result = await db.get(
                `SELECT * FROM consentements
                 WHERE user_jid = ? AND consent_type = ?
                 AND consent_given = 1
                 AND (expiry_date IS NULL OR expiry_date > datetime('now'))
                 AND revocation_date IS NULL`,
                [userJid, consentType]
            );

            return {
                hasConsent: !!result,
                consentDate: result?.consent_date || null,
                version: result?.consent_version || null
            };
        } catch (error) {
            logger.error('Erreur lors de la vérification du consentement', {
                error: error.message,
                userJid,
                consentType
            });
            return { hasConsent: false, error: error.message };
        }
    }

    async updateConsent(userJid, consentType, consentGiven, metadata = {}) {
        try {
            const now = new Date().toISOString();
            const expiryDate = consentGiven ?
                new Date(Date.now() + this.consentExpiryDays * 24 * 60 * 60 * 1000).toISOString() :
                null;

            const result = await db.run(
                `INSERT INTO consentements (user_jid, consent_type, consent_given, consent_date, consent_version, expiry_date, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(user_jid, consent_type) DO UPDATE SET
                 consent_given = excluded.consent_given,
                 consent_date = excluded.consent_date,
                 consent_version = excluded.consent_version,
                 expiry_date = excluded.expiry_date,
                 revocation_date = NULL,
                 notes = excluded.notes`,
                [
                    userJid,
                    consentType,
                    consentGiven ? 1 : 0,
                    now,
                    this.version,
                    expiryDate,
                    JSON.stringify(metadata)
                ]
            );

            logger.info(`Consentement mis à jour pour ${userJid}`, { consentType, consentGiven });

            return { success: true, result };
        } catch (error) {
            logger.error('Erreur lors de la mise à jour du consentement', {
                error: error.message,
                userJid,
                consentType
            });
            return { success: false, error: error.message };
        }
    }

    async revokeConsent(userJid, consentType) {
        try {
            const now = new Date().toISOString();
            await db.run(
                `UPDATE consentements SET consent_given = 0, revocation_date = ? WHERE user_jid = ? AND consent_type = ?`,
                [now, userJid, consentType]
            );

            logger.info(`Consentement révoqué pour ${userJid}`, { consentType });
            return { success: true };
        } catch (error) {
            logger.error('Erreur lors de la révocation du consentement', {
                error: error.message,
                userJid,
                consentType
            });
            return { success: false, error: error.message };
        }
    }

    async requestOptIn(userJid, optInType) {
        try {
            const token = this.generateToken();
            const now = new Date().toISOString();
            const expiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

            await db.run(
                `INSERT INTO opt_in_tracking (user_jid, opt_in_type, request_date, confirmation_token, token_expiry, is_confirmed)
                 VALUES (?, ?, ?, ?, ?, 0)
                 ON CONFLICT(user_jid, opt_in_type) DO UPDATE SET
                 request_date = excluded.request_date,
                 confirmation_token = excluded.confirmation_token,
                 token_expiry = excluded.token_expiry,
                 is_confirmed = 0`,
                [userJid, optInType, now, token, expiryDate]
            );

            logger.info(`Demande d'opt-in créée pour ${userJid}`, { optInType });
            return { success: true, token, expiryDate };
        } catch (error) {
            logger.error('Erreur lors de la demande d\'opt-in', { error: error.message, userJid, optInType });
            return { success: false, error: error.message };
        }
    }

    async confirmOptIn(userJid, optInType, token) {
        try {
            const result = await db.get(
                `SELECT * FROM opt_in_tracking
                 WHERE user_jid = ? AND opt_in_type = ? AND confirmation_token = ?
                 AND token_expiry > datetime('now') AND is_confirmed = 0`,
                [userJid, optInType, token]
            );

            if (!result) {
                return { success: false, error: 'Token invalide ou expiré' };
            }

            const now = new Date().toISOString();
            await db.run(
                `UPDATE opt_in_tracking SET is_confirmed = 1, confirmation_date = ?
                 WHERE user_jid = ? AND opt_in_type = ? AND confirmation_token = ?`,
                [now, userJid, optInType, token]
            );

            await this.updateConsent(userJid, optInType, true, {
                confirmed_via: 'opt_in',
                confirmation_date: now
            });

            logger.info(`Opt-in confirmé pour ${userJid}`, { optInType });
            return { success: true };
        } catch (error) {
            logger.error('Erreur lors de la confirmation de l\'opt-in', { error: error.message, userJid, optInType });
            return { success: false, error: error.message };
        }
    }

    async exportUserData(userJid) {
        try {
            const requestId = await this.createDataRequest(userJid, 'export');
            const data = await this.collectUserData(userJid);
            const now = new Date().toISOString();

            await db.run(
                `UPDATE user_data_requests SET status = 'completed', completion_date = ?, data_export_path = ? WHERE id = ?`,
                [now, `exports/${userJid}_${Date.now()}.json`, requestId]
            );

            logger.info(`Export de données pour ${userJid}`, { requestId });
            return { success: true, data, requestId };
        } catch (error) {
            logger.error('Erreur lors de l\'export des données', { error: error.message, userJid });
            return { success: false, error: error.message };
        }
    }

    async collectUserData(userJid) {
        return {
            userJid,
            timestamp: new Date().toISOString(),
            data: {
                consentements: await db.all('SELECT * FROM consentements WHERE user_jid = ?', [userJid]),
                optIns: await db.all('SELECT * FROM opt_in_tracking WHERE user_jid = ?', [userJid])
            }
        };
    }

    async deleteUserData(userJid) {
        try {
            await this.createDataRequest(userJid, 'delete');

            const tables = ['consentements', 'opt_in_tracking', 'appareils_connus', 'alertes_anomalies'];
            for (const table of tables) {
                await db.run(`DELETE FROM ${table} WHERE user_jid = ?`, [userJid]);
            }

            logger.info(`Données supprimées pour ${userJid}`);
            return { success: true };
        } catch (error) {
            logger.error('Erreur lors de la suppression des données', { error: error.message, userJid });
            return { success: false, error: error.message };
        }
    }

    async createDataRequest(userJid, requestType) {
        const now = new Date().toISOString();
        const result = await db.run(
            `INSERT INTO user_data_requests (user_jid, request_type, request_date, status) VALUES (?, ?, ?, 'pending')`,
            [userJid, requestType, now]
        );
        return result.lastID;
    }

    async generateToken() {
        const { randomBytes } = await import('crypto');
        return randomBytes(32).toString('hex');
    }

    async checkUserCompliance(userJid) {
        try {
            const requiredConsents = ['data_processing', 'notifications'];
            const results = {};

            for (const consentType of requiredConsents) {
                results[consentType] = await this.checkConsent(userJid, consentType);
            }

            const allConsented = requiredConsents.every(type => results[type].hasConsent);

            return { compliant: allConsented, details: results, requiredConsents };
        } catch (error) {
            logger.error('Erreur lors de la vérification de conformité', { error: error.message, userJid });
            return { compliant: false, error: error.message };
        }
    }
}

let instance = null;

export function getComplianceManager() {
    if (!instance) {
        instance = new ComplianceManager();
    }
    return instance;
}

/* Wrappers fonctionnels attendus par src/api/webhook.js (GET /export/:jid, DELETE /data/:jid).
   Délèguent au singleton pour ne pas dupliquer l'état/la logique de ComplianceManager. */
export async function exportData(userJid) {
    return getComplianceManager().exportUserData(userJid);
}

export async function deleteData(userJid) {
    return getComplianceManager().deleteUserData(userJid);
}

export default ComplianceManager;
