'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — PROTECTION MODULE
 * ============================================================
 *
 * Centralized protection checks for commands:
 * - Injection detection
 * - Rate limiting
 * - Input sanitization
 * - JID validation
 *
 * ============================================================
 */

const security = require('../../lib/security.cjs');

module.exports = {
    isEnabled: () => true,
    check: (text) => {
        if (!text) return { ok: true };
        const injection = security.detectInjection(text);
        if (injection.detected) return { ok: false, reason: 'injection', pattern: injection.pattern };
        return { ok: true };
    },
    sanitize: (text) => security.sanitizeInput(text),
    validateJid: (jid) => security.isValidJid(jid),
};
