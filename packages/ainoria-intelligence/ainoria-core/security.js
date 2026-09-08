import crypto from 'crypto';
import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';

const log = createLogger('SECURITY');

const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS_PER_WINDOW = 30;
const requestCounts = new Map();

const ENCRYPTION_KEY = process.env.AINORIA_ENCRYPTION_KEY || process.env.DJOUSSE_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || '';

export class SecurityManager {
  constructor() {
    this.initialized = false;
    this.rateLimits = new Map();
  }

  async init() {
    if (this.initialized) return;
    try {
      rawRun(`CREATE TABLE IF NOT EXISTS ainoria_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL,
        actor TEXT, resource TEXT, detail TEXT, ip TEXT,
        success INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
      )`);
      rawRun(`CREATE INDEX IF NOT EXISTS idx_audit_action ON ainoria_audit_log(action)`);
      rawRun(`CREATE INDEX IF NOT EXISTS idx_audit_created ON ainoria_audit_log(created_at)`);

      rawRun(`CREATE TABLE IF NOT EXISTS ainoria_encrypted_data (
        id TEXT PRIMARY KEY, owner TEXT NOT NULL, data_type TEXT NOT NULL,
        encrypted_data TEXT NOT NULL, iv TEXT NOT NULL, created_at INTEGER NOT NULL
      )`);
      this.initialized = true;
      log.info('Security module initialise');
    } catch (err) { log.warn(`Security init: ${err.message}`); }
  }

  encrypt(plaintext) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
      let encrypted = cipher.update(typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return { encrypted, iv: iv.toString('hex') };
    } catch (err) { log.error(`Encrypt error: ${err.message}`); return null; }
  }

  decrypt(encrypted, ivHex) {
    try {
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) { log.error(`Decrypt error: ${err.message}`); return null; }
  }

  storeEncrypted(owner, dataType, plaintext) {
    const id = `enc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result = this.encrypt(plaintext);
    if (!result) return null;
    rawRun('INSERT INTO ainoria_encrypted_data (id, owner, data_type, encrypted_data, iv, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      id, owner, dataType, result.encrypted, result.iv, Date.now());
    return id;
  }

  retrieveEncrypted(id) {
    const row = rawGet('SELECT * FROM ainoria_encrypted_data WHERE id = ?', id);
    if (!row) return null;
    return this.decrypt(row.encrypted_data, row.iv);
  }

  checkRateLimit(key, maxRequests = MAX_REQUESTS_PER_WINDOW, window = RATE_LIMIT_WINDOW) {
    const now = Date.now();
    const entry = this.rateLimits.get(key) || { count: 0, resetAt: now + window };
    if (now > entry.resetAt) {
      entry.count = 1;
      entry.resetAt = now + window;
    } else {
      entry.count++;
    }
    this.rateLimits.set(key, entry);
    return { allowed: entry.count <= maxRequests, remaining: Math.max(0, maxRequests - entry.count), resetAt: entry.resetAt };
  }

  audit(action, opts = {}) {
    try {
      rawRun('INSERT INTO ainoria_audit_log (action, actor, resource, detail, ip, success, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        action, opts.actor || 'system', opts.resource || null,
        (opts.detail || '').slice(0, 500), opts.ip || null,
        opts.success !== false ? 1 : 0, Date.now());
    } catch {}
  }

  validateInput(input, schema) {
    if (!input || !schema) return { valid: true };
    const errors = [];
    for (const [field, rules] of Object.entries(schema)) {
      const val = input[field];
      if (rules.required && (val === undefined || val === null || val === '')) {
        errors.push(`${field} requis`);
        continue;
      }
      if (val === undefined || val === null) continue;
      if (rules.type === 'string' && typeof val !== 'string') errors.push(`${field} doit etre une chaine`);
      if (rules.type === 'number' && typeof val !== 'number') errors.push(`${field} doit etre un nombre`);
      if (rules.maxLength && typeof val === 'string' && val.length > rules.maxLength) errors.push(`${field} depasse ${rules.maxLength} caracteres`);
      if (rules.min && typeof val === 'number' && val < rules.min) errors.push(`${field} minimum ${rules.min}`);
      if (rules.max && typeof val === 'number' && val > rules.max) errors.push(`${field} maximum ${rules.max}`);
      if (rules.pattern && typeof val === 'string' && !rules.pattern.test(val)) errors.push(`${field} format invalide`);
      if (rules.enum && !rules.enum.includes(val)) errors.push(`${field} doit etre parmi: ${rules.enum.join(', ')}`);
    }
    return { valid: errors.length === 0, errors };
  }

  sanitize(str, maxLength = 5000) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>"'&]/g, '').slice(0, maxLength);
  }

  getAuditLog(limit = 50) {
    try { return rawAll('SELECT * FROM ainoria_audit_log ORDER BY created_at DESC LIMIT ?', limit); }
    catch { return []; }
  }

  getStats() {
    try {
      const total = rawGet('SELECT COUNT(*) as c FROM ainoria_audit_log')?.c || 0;
      return { initialized: this.initialized, rateLimitEntries: this.rateLimits.size, auditEntries: total };
    } catch { return { initialized: this.initialized, rateLimitEntries: 0, auditEntries: 0 }; }
  }
}

export const securityManager = new SecurityManager();
export default securityManager;
