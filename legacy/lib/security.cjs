'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — SECURITY MODULE
 * ============================================================
 *
 * Input validation and injection prevention:
 * - Sanitize user input (remove null bytes, control chars)
 * - Validate JIDs (proper WhatsApp format)
 * - Block command injection attempts
 * - Protect secrets from being logged/exposed
 * - Rate limit per-user command attempts
 *
 * ============================================================
 */

// --- Input Sanitization ---
function sanitizeInput(text) {
    if (typeof text !== 'string') return '';
    // Remove null bytes and control characters (except newlines/tabs)
    return text
        .replace(/\0/g, '')
        .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '')
        .trim();
}

// --- JID Validation ---
function isValidJid(jid) {
    if (!jid || typeof jid !== 'string') return false;
    // WhatsApp JID format: number@s.whatsapp.net or number@g.us or number@lid
    const jidRegex = /^\d{5,20}@(s\.whatsapp\.net|g\.us|lid|hosted\.lid)$/;
    return jidRegex.test(jid);
}

function isGroupJid(jid) {
    return jid && typeof jid === 'string' && jid.endsWith('@g.us');
}

function isUserJid(jid) {
    return jid && typeof jid === 'string' && jid.endsWith('@s.whatsapp.net');
}

// --- Command Injection Prevention ---
const INJECTION_PATTERNS = [
    /\$\(/,          // Bash $()
    /`[^`]*`/,       // Backticks
    /\|\|/,          // ||
    /&&/,            // &&
    /;\s*\w/,        // Semicolons
    /\beval\b/,      // eval()
    /\bexec\b/,      // exec()
    /\brequire\b.*\(/, // require() calls
    /process\./,     // process access
    /child_process/, // child_process
    /\bfs\b/,        // fs module
    /\bmodule\b/,    // module access
    /\b__/,          // Dunder vars
    /\.\.\/\.\.\//, // Directory traversal
    /\\x[0-9a-f]{2}/i, // Hex escapes
];

function detectInjection(text) {
    if (typeof text !== 'string') return false;
    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(text)) return { detected: true, pattern: pattern.source };
    }
    return { detected: false };
}

// --- Secret Protection ---
const SECRET_PATTERNS = [
    /session[_-]?id/i,
    /api[_-]?key/i,
    /token/i,
    /password/i,
    /secret/i,
    /credential/i,
    /private[_-]?key/i,
    /bot[_-]?token/i,
];

function containsSecret(text) {
    if (typeof text !== 'string') return false;
    return SECRET_PATTERNS.some(p => p.test(text));
}

function maskSecrets(text) {
    if (typeof text !== 'string') return text;
    return text
        .replace(/[A-Za-z0-9]{20,}/g, (match) => match.substring(0, 4) + '****')
        .replace(/\d{10,}/g, (match) => match.substring(0, 3) + '****');
}

// --- Per-User Rate Limiting ---
const commandAttempts = new Map();
const RATE_WINDOW = 60000; // 1 minute
const MAX_COMMANDS_PER_MIN = 15;

function checkRateLimit(userId) {
    const now = Date.now();
    if (!commandAttempts.has(userId)) commandAttempts.set(userId, []);

    const attempts = commandAttempts.get(userId).filter(t => now - t < RATE_WINDOW);
    commandAttempts.set(userId, attempts);

    if (attempts.length >= MAX_COMMANDS_PER_MIN) {
        return {
            allowed: false,
            remaining: 0,
            retryAfter: attempts[0] + RATE_WINDOW - now,
        };
    }

    attempts.push(now);
    return {
        allowed: true,
        remaining: MAX_COMMANDS_PER_MIN - attempts.length,
    };
}

// --- Message Length Validation ---
const MAX_MESSAGE_LENGTH = 4000;
const MAX_CAPTION_LENGTH = 1024;

function validateMessageLength(text, isCaption = false) {
    const maxLen = isCaption ? MAX_CAPTION_LENGTH : MAX_MESSAGE_LENGTH;
    if (typeof text !== 'string') return { valid: true };
    if (text.length > maxLen) {
        return {
            valid: false,
            length: text.length,
            maxAllowed: maxLen,
            truncated: text.substring(0, maxLen - 20) + '...[tronqué]',
        };
    }
    return { valid: true };
}

// --- URL Validation ---
function isSafeUrl(url) {
    if (typeof url !== 'string') return false;
    try {
        const parsed = new URL(url);
        // Only allow http/https
        if (!['http:', 'https:'].includes(parsed.protocol)) return false;
        // Block internal IPs
        const host = parsed.hostname;
        if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return false;
        if (/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(host)) return false;
        return true;
    } catch {
        return false;
    }
}

function cleanupRateLimits() {
    const now = Date.now();
    for (const [userId, attempts] of commandAttempts) {
        const valid = attempts.filter(t => now - t < RATE_WINDOW);
        if (valid.length === 0) commandAttempts.delete(userId);
        else commandAttempts.set(userId, valid);
    }
}

setInterval(cleanupRateLimits, 60000);

module.exports = {
    sanitizeInput,
    isValidJid,
    isGroupJid,
    isUserJid,
    detectInjection,
    containsSecret,
    maskSecrets,
    checkRateLimit,
    validateMessageLength,
    isSafeUrl,
};
