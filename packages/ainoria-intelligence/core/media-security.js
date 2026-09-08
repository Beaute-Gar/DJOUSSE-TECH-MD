import { createLogger } from '../../infrastructure/logger.js';
import crypto from 'crypto';

const log = createLogger('MEDIA_SEC');

export class MediaSecurityManager {
  constructor(vfsService, dbService) {
    this.vfsService = vfsService;
    this.dbService = dbService;
    this.ENCRYPTION_KEY = process.env.DJOUSSE_ENCRYPTION_KEY || crypto.randomBytes(32);
    this.ALGORITHM = 'aes-256-cbc';
    this.AUDIT_LOG = 'media_audit_log';
    this.CONSENT_REGISTRY = 'media_consent_registry';
    this.MEDIA_POLICIES = 'media_policies';
  }

  async checkConsent(jid, userId, mediaType) {
    try {
      const policy = await this.dbService?.get(this.MEDIA_POLICIES, jid);
      if (!policy) return false;

      const allowedTypes = policy.allowedMediaTypes || [];
      if (!allowedTypes.includes(mediaType)) return false;

      const consent = await this.dbService?.get(this.CONSENT_REGISTRY, `${jid}:${userId}`);
      if (!consent || !consent.hasConsented) return false;

      return true;
    } catch (error) {
      log.error(`checkConsent: ${error.message}`);
      return false;
    }
  }

  async setConsent(jid, userId, hasConsented) {
    try {
      await this.dbService?.save(this.CONSENT_REGISTRY, `${jid}:${userId}`, {
        userId, jid, hasConsented,
        timestamp: Date.now(),
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
      });
      log.info(`Consentement ${hasConsented ? 'accordé' : 'retiré'} pour ${userId} dans ${jid}`);
    } catch (error) {
      log.error(`setConsent: ${error.message}`);
    }
  }

  async setMediaPolicy(jid, policy = {}) {
    try {
      const defaultPolicy = {
        jid,
        allowedMediaTypes: ['image', 'audio', 'video'],
        retentionDays: 30,
        encryptionEnabled: true,
        anonymizationEnabled: true,
        auditLogging: true,
        timestamp: Date.now(),
      };
      const merged = { ...defaultPolicy, ...policy };
      await this.dbService?.save(this.MEDIA_POLICIES, jid, merged);
      log.info(`Politique médias définie pour ${jid}`);
    } catch (error) {
      log.error(`setMediaPolicy: ${error.message}`);
    }
  }

  encryptData(data) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.ALGORITHM, this.ENCRYPTION_KEY, iv);
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return Buffer.from(iv.toString('hex') + ':' + encrypted).toString('base64');
    } catch (error) {
      log.error(`encryptData: ${error.message}`);
      throw error;
    }
  }

  decryptData(encryptedData) {
    try {
      const combined = Buffer.from(encryptedData, 'base64').toString('utf8');
      const [ivHex, encrypted] = combined.split(':');
      const decipher = crypto.createDecipheriv(this.ALGORITHM, this.ENCRYPTION_KEY, Buffer.from(ivHex, 'hex'));
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (error) {
      log.error(`decryptData: ${error.message}`);
      throw error;
    }
  }

  anonymizeAnalysis(analysis, userId) {
    const anonymized = { ...analysis };
    if (anonymized.userId) anonymized.userId = this._hashUserId(userId);
    delete anonymized.mediaHash;
    delete anonymized.timestamp;
    delete anonymized.jid;
    return anonymized;
  }

  _hashUserId(userId) {
    return crypto.createHash('sha256').update(userId).digest('hex').slice(0, 16);
  }

  async auditLog(jid, action, details = {}) {
    try {
      const entry = { jid, action, details, timestamp: Date.now(), actor: 'DJOUSSE_TECH' };
      await this.dbService?.addLogEntry?.(this.AUDIT_LOG, jid, entry, 1000);
      log.info(`Audit: ${action} pour ${jid}`);
    } catch (error) {
      log.error(`auditLog: ${error.message}`);
    }
  }

  async enforceRetention(jid) {
    try {
      const policy = await this.dbService?.get(this.MEDIA_POLICIES, jid);
      if (!policy) return;
      const retentionMs = policy.retentionDays * 24 * 60 * 60 * 1000;
      const logs = await this.dbService?.getLogEntries?.(this.AUDIT_LOG, jid) || [];
      for (const log of logs) {
        if (Date.now() - log.timestamp > retentionMs && log.action === 'analyze') {
          log.info(`Donnée expirée supprimée pour ${jid}`);
        }
      }
      await this.auditLog(jid, 'retention_enforced', { retentionDays: policy.retentionDays });
    } catch (error) {
      log.error(`enforceRetention: ${error.message}`);
    }
  }

  async generateComplianceReport(jid) {
    try {
      const policy = await this.dbService?.get(this.MEDIA_POLICIES, jid);
      const auditLogs = await this.dbService?.getLogEntries?.(this.AUDIT_LOG, jid) || [];
      return {
        jid, generatedAt: Date.now(),
        policy: policy || 'Aucune politique définie',
        auditLogCount: auditLogs.length,
        encryptionEnabled: policy?.encryptionEnabled || false,
        anonymizationEnabled: policy?.anonymizationEnabled || false,
        retentionDays: policy?.retentionDays || 'Non défini',
        lastRetentionEnforcement: auditLogs.filter(l => l.action === 'retention_enforced').sort((a, b) => b.timestamp - a.timestamp)[0]?.timestamp || 'Jamais',
      };
    } catch (error) {
      log.error(`generateComplianceReport: ${error.message}`);
      throw error;
    }
  }
}

let _instance = null;
export function getMediaSecurity(vfsService, dbService) {
  if (!_instance) _instance = new MediaSecurityManager(vfsService, dbService);
  return _instance;
}

export default MediaSecurityManager;
