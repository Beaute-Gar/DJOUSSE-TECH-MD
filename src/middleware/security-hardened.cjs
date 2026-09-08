/**
 * Security Hardened — DJOUSSE-TECH-MD v3.0
 * 
 * Sécurité renforcée production :
 * - Rate limiting global (par IP, par utilisateur)
 * - Validation des entrées
 * - Sanitisation des outputs
 * - Chiffrement des credentials
 * - Protection contre injection
 * - Headers de sécurité
 * - Audit logging
 * 
 * Compatible CJS, Express middleware.
 */

const crypto = require('crypto');

/* ═══════════════════════════════════════════════════════════════════
   CONFIGURATION
   ═══════════════════════════════════════════════════════════════════ */
const SECURITY_CONFIG = {
    // Rate limiting
    RATE_LIMIT_WINDOW: 60000,        // 1 minute
    RATE_LIMIT_MAX: 30,              // 30 requêtes/minute/IP
    RATE_LIMIT_USER_MAX: 20,         // 20 requêtes/minute/utilisateur
    
    // Chiffrement
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'),
    ENCRYPTION_IV_LENGTH: 16,
    
    // Validation
    MAX_JID_LENGTH: 50,
    MAX_BODY_LENGTH: 10000,
    MAX_MESSAGE_LENGTH: 65536,
    
    // Patterns dangereux
    DANGEROUS_PATTERNS: [
        /[<>"'`;\\]/i,
        /javascript:/i,
        /data:text\/html/i,
        /on\w+\s*=/i,
    ],
};

/* ═══════════════════════════════════════════════════════════════════
   RATE LIMITER
   ═══════════════════════════════════════════════════════════════════ */
class RateLimiter {
    constructor() {
        this.ipCounts = new Map();
        this.userCounts = new Map();
        
        // Nettoyage périodique
        setInterval(() => this.cleanup(), 60000);
    }

    cleanup() {
        const now = Date.now();
        
        for (const [key, data] of this.ipCounts) {
            if (now - data.windowStart > SECURITY_CONFIG.RATE_LIMIT_WINDOW * 2) {
                this.ipCounts.delete(key);
            }
        }
        
        for (const [key, data] of this.userCounts) {
            if (now - data.windowStart > SECURITY_CONFIG.RATE_LIMIT_WINDOW * 2) {
                this.userCounts.delete(key);
            }
        }
    }

    check(ip, userId = null) {
        const now = Date.now();
        
        // Check IP
        const ipResult = this.checkKey(`ip:${ip}`, this.ipCounts, SECURITY_CONFIG.RATE_LIMIT_MAX, now);
        if (!ipResult.allowed) return ipResult;
        
        // Check user
        if (userId) {
            const userResult = this.checkKey(`user:${userId}`, this.userCounts, SECURITY_CONFIG.RATE_LIMIT_USER_MAX, now);
            if (!userResult.allowed) return userResult;
        }
        
        return { allowed: true };
    }

    checkKey(key, store, max, now) {
        if (!store.has(key)) {
            store.set(key, { count: 1, windowStart: now });
            return { allowed: true };
        }

        const data = store.get(key);

        if (now - data.windowStart > SECURITY_CONFIG.RATE_LIMIT_WINDOW) {
            data.count = 1;
            data.windowStart = now;
            return { allowed: true };
        }

        data.count++;

        if (data.count > max) {
            return { 
                allowed: false, 
                reason: `Rate limit dépassé (${data.count}/${max})`,
                retryAfter: SECURITY_CONFIG.RATE_LIMIT_WINDOW - (now - data.windowStart),
            };
        }

        return { allowed: true };
    }
}

/* ═══════════════════════════════════════════════════════════════════
   VALIDATION
   ═══════════════════════════════════════════════════════════════════ */
function validateJID(jid) {
    if (!jid || typeof jid !== 'string') return false;
    if (jid.length > SECURITY_CONFIG.MAX_JID_LENGTH) return false;
    
    // Format: number@s.whatsapp.net ou number@g.us ou number@lid
    const validPattern = /^\d+[@:.](s\.whatsapp\.net|g\.us|lid|broadcast)$/;
    return validPattern.test(jid);
}

function validateMessage(text) {
    if (!text || typeof text !== 'string') return true; // Pas de texte = OK
    if (text.length > SECURITY_CONFIG.MAX_MESSAGE_LENGTH) return false;
    
    // Vérifier les patterns dangereux
    for (const pattern of SECURITY_CONFIG.DANGEROUS_PATTERNS) {
        if (pattern.test(text)) return false;
    }
    
    return true;
}

function validateCommand(cmd) {
    if (!cmd || typeof cmd !== 'string') return false;
    if (cmd.length > 100) return false;
    
    // Seulement caractères alphanumériques, tirets, underscores
    return /^[a-zA-Z0-9_-]+$/.test(cmd);
}

/* ═══════════════════════════════════════════════════════════════════
   SANITISATION
   ═══════════════════════════════════════════════════════════════════ */
function sanitizeInput(text) {
    if (!text || typeof text !== 'string') return text;
    
    return text
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\\/g, '&#x5C;')
        .trim();
}

function sanitizeForLog(text) {
    if (!text || typeof text !== 'string') return text;
    
    // Supprimer les caractères de contrôle
    return text
        .replace(/[\x00-\x1f\x7f-\x9f]/g, '')
        .replace(/\n/g, ' ')
        .slice(0, 500);
}

/* ═══════════════════════════════════════════════════════════════════
   CHIFFREMENT
   ═══════════════════════════════════════════════════════════════════ */
function encrypt(text) {
    const key = Buffer.from(SECURITY_CONFIG.ENCRYPTION_KEY.slice(0, 32), 'hex');
    const iv = crypto.randomBytes(SECURITY_CONFIG.ENCRYPTION_IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText) {
    const key = Buffer.from(SECURITY_CONFIG.ENCRYPTION_KEY.slice(0, 32), 'hex');
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

/* ═══════════════════════════════════════════════════════════════════
   MIDDLEWARE EXPRESS
   ═══════════════════════════════════════════════════════════════════ */
const rateLimiter = new RateLimiter();

function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'");
    next();
}

function rateLimitMiddleware(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const userId = req.user?.id || null;
    
    const result = rateLimiter.check(ip, userId);
    
    if (!result.allowed) {
        res.setHeader('Retry-After', Math.ceil(result.retryAfter / 1000));
        return res.status(429).json({ 
            error: 'Too Many Requests', 
            message: result.reason,
            retryAfter: Math.ceil(result.retryAfter / 1000),
        });
    }
    
    next();
}

function inputValidation(req, res, next) {
    // Valider le body
    if (req.body) {
        for (const [key, value] of Object.entries(req.body)) {
            if (typeof value === 'string' && !validateMessage(value)) {
                return res.status(400).json({ 
                    error: 'Invalid Input', 
                    message: `Champ "${key}" contient des caractères non autorisés` 
                });
            }
        }
    }
    
    // Valider les query params
    for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string' && !validateMessage(value)) {
            return res.status(400).json({ 
                error: 'Invalid Input', 
                message: `Paramètre "${key}" invalide` 
            });
        }
    }
    
    next();
}

/* ═══════════════════════════════════════════════════════════════════
   EXPORTS
   ═══════════════════════════════════════════════════════════════════ */
module.exports = {
    RateLimiter,
    rateLimiter,
    securityHeaders,
    rateLimitMiddleware,
    inputValidation,
    validateJID,
    validateMessage,
    validateCommand,
    sanitizeInput,
    sanitizeForLog,
    encrypt,
    decrypt,
    SECURITY_CONFIG,
};
