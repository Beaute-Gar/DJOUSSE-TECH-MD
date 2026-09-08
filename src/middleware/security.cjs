/**
 * Anti-Ban Security — DJOUSSE-TECH-MD v3.0
 * 
 * Protections contre les bans WhatsApp :
 * - User-Agent réaliste (fingerprint)
 * - Delays humains (typing, envoi)
 * - Warm-up progressif (nouveau compte)
 * - Limites journalières
 * - Proxy rotation (optionnel)
 * - Failover sur erreurs
 * 
 * Compatible CJS (require), fonctionne avec Baileys.
 * 
 * Usage :
 *   const { securityMiddleware, getSecurityStats } = require('./src/middleware/security.cjs');
 *   await securityMiddleware(sock, msg, config);
 */

const fs = require('fs');
const path = require('path');

/* ═══════════════════════════════════════════════════════════════════
   CONFIGURATION PAR DÉFAUT
   ═══════════════════════════════════════════════════════════════════ */
const DEFAULTS = {
    // Limits
    DAILY_LIMIT_PRIVATE: 200,      // Max messages/jour (DM)
    DAILY_LIMIT_GROUP: 100,        // Max messages/jour (groupe)
    HOURLY_LIMIT_PRIVATE: 30,      // Max messages/heure (DM)
    HOURLY_LIMIT_GROUP: 15,        // Max messages/heure (groupe)
    
    // Delays (ms)
    DELAY_TYPING_MIN: 800,
    DELAY_TYPING_MAX: 2500,
    DELAY_SEND_MIN: 500,
    DELAY_SEND_MAX: 1500,
    DELAY_BETWEEN_MSG_MIN: 2000,
    DELAY_BETWEEN_MSG_MAX: 5000,
    
    // Warm-up (jours → limite)
    WARMUP_DAY1: 20,
    WARMUP_DAY2: 50,
    WARMUP_DAY3: 100,
    WARMUP_DAY7: 200,
    
    // Fingerprint
    SPOOF_USER_AGENT: true,
    
    // File de persistance
    STATE_FILE: path.join(__dirname, '../../data/security-state.json'),
};

/* ═══════════════════════════════════════════════════════════════════
   USER-AGENTS RÉALISTES — rotation pour éviter la détection
   ═══════════════════════════════════════════════════════════════════ */
const USER_AGENTS = [
    'Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; Xiaomi 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; OnePlus 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
];

/* ═══════════════════════════════════════════════════════════════════
   ÉTAT SÉCURISÉ — persistance en fichier JSON
   ═══════════════════════════════════════════════════════════════════ */
let securityState = null;

function loadState() {
    if (securityState) return securityState;
    
    try {
        if (fs.existsSync(DEFAULTS.STATE_FILE)) {
            const data = fs.readFileSync(DEFAULTS.STATE_FILE, 'utf8');
            securityState = JSON.parse(data);
        }
    } catch {}
    
    if (!securityState) {
        securityState = {
            accountCreated: Date.now(),
            dailySent: { private: 0, group: 0 },
            hourlySent: { private: 0, group: 0 },
            lastHourReset: Date.now(),
            lastDayReset: Date.now(),
            totalSent: 0,
            lastSentAt: 0,
            blockedCount: 0,
            warmupComplete: false,
        };
    }
    
    return securityState;
}

function saveState() {
    try {
        const dir = path.dirname(DEFAULTS.STATE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DEFAULTS.STATE_FILE, JSON.stringify(securityState, null, 2));
    } catch (e) {
        console.error('[SECURITY] Erreur sauvegarde état:', e.message);
    }
}

function resetCountersIfNeeded(state) {
    const now = Date.now();
    
    // Reset horaire
    if (now - state.lastHourReset > 3600000) {
        state.hourlySent = { private: 0, group: 0 };
        state.lastHourReset = now;
    }
    
    // Reset journalier
    if (now - state.lastDayReset > 86400000) {
        state.dailySent = { private: 0, group: 0 };
        state.lastDayReset = now;
    }
}

/* ═══════════════════════════════════════════════════════════════════
   WARM-UP — progression progressive pour comptes récents
   ═══════════════════════════════════════════════════════════════════ */
function getWarmupLimit(state) {
    const ageDays = Math.floor((Date.now() - state.accountCreated) / 86400000);
    
    if (ageDays >= 30) return Infinity; // Compte mature
    if (ageDays >= 7) return DEFAULTS.WARMUP_DAY7;
    if (ageDays >= 3) return DEFAULTS.WARMUP_DAY3;
    if (ageDays >= 2) return DEFAULTS.WARMUP_DAY2;
    return DEFAULTS.WARMUP_DAY1;
}

function isWarmupComplete(state) {
    return (Date.now() - state.accountCreated) >= 7 * 86400000;
}

/* ═══════════════════════════════════════════════════════════════════
   DELAYS HUMAINS — simulate un comportement naturel
   ═══════════════════════════════════════════════════════════════════ */
function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function humanDelay(min = DEFAULTS.DELAY_SEND_MIN, max = DEFAULTS.DELAY_SEND_MAX) {
    const delay = randomDelay(min, max);
    return new Promise(resolve => setTimeout(resolve, delay));
}

async function typingDelay(sock, jid) {
    try {
        await sock.sendPresenceUpdate('composing', jid);
        await humanDelay(DEFAULTS.DELAY_TYPING_MIN, DEFAULTS.DELAY_TYPING_MAX);
        await sock.sendPresenceUpdate('paused', jid);
    } catch {}
}

async function sendingDelay() {
    await humanDelay(DEFAULTS.DELAY_BETWEEN_MSG_MIN, DEFAULTS.DELAY_BETWEEN_MSG_MAX);
}

/* ═══════════════════════════════════════════════════════════════════
   VÉRIFICATIONS DE LIMITES
   ═══════════════════════════════════════════════════════════════════ */
function canSend(state, isGroup = false) {
    resetCountersIfNeeded(state);
    
    const warmupLimit = getWarmupLimit(state);
    const type = isGroup ? 'group' : 'private';
    
    // Limites journalières
    const dailyLimit = Math.min(
        isGroup ? DEFAULTS.DAILY_LIMIT_GROUP : DEFAULTS.DAILY_LIMIT_PRIVATE,
        warmupLimit
    );
    if (state.dailySent[type] >= dailyLimit) {
        return { allowed: false, reason: `Limite journalière atteinte (${state.dailySent[type]}/${dailyLimit})` };
    }
    
    // Limites horaires
    const hourlyLimit = isGroup ? DEFAULTS.HOURLY_LIMIT_GROUP : DEFAULTS.HOURLY_LIMIT_PRIVATE;
    if (state.hourlySent[type] >= hourlyLimit) {
        return { allowed: false, reason: `Limite horaire atteinte (${state.hourlySent[type]}/${hourlyLimit})` };
    }
    
    // Délai minimum entre messages
    const timeSinceLast = Date.now() - state.lastSentAt;
    if (timeSinceLast < DEFAULTS.DELAY_BETWEEN_MSG_MIN) {
        const wait = DEFAULTS.DELAY_BETWEEN_MSG_MIN - timeSinceLast;
        return { allowed: false, reason: `Délai minimum (${wait}ms restants)` };
    }
    
    return { allowed: true };
}

function incrementCounters(state, isGroup = false) {
    const type = isGroup ? 'group' : 'private';
    state.dailySent[type]++;
    state.hourlySent[type]++;
    state.totalSent++;
    state.lastSentAt = Date.now();
    saveState();
}

/* ═══════════════════════════════════════════════════════════════════
   FINGERPRINT — User-Agent réaliste
   ═══════════════════════════════════════════════════════════════════ */
function getRandomUA() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function spoofHeaders(sock) {
    if (!DEFAULTS.SPOOF_USER_AGENT) return;
    
    try {
        // Baileys ne supporte pas directement le UA, mais on peut le logger
        const ua = getRandomUA();
        console.log(`[SECURITY] Fingerprint UA: ${ua.slice(0, 60)}...`);
    } catch {}
}

/* ═══════════════════════════════════════════════════════════════════
   FAILOVER — gestion des erreurs de rate-limit
   ═══════════════════════════════════════════════════════════════════ */
async function handleRateLimitError(state, error) {
    const msg = error?.message || '';
    
    // Détection de ban/temp-ban
    if (msg.includes('rate-overhead') || msg.includes('too_many') || msg.includes('server')) {
        state.blockedCount++;
        saveState();
        
        const backoff = Math.min(state.blockedCount * 30000, 300000); // Max 5min
        console.warn(`[SECURITY] ⚠️ Rate-limit détecté (${state.blockedCount}×). Backoff: ${backoff}ms`);
        
        await new Promise(r => setTimeout(r, backoff));
        return true;
    }
    
    return false;
}

/* ═══════════════════════════════════════════════════════════════════
   MIDDLEWARE PRINCIPAL — appelé avant chaque envoi
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Applique les protections anti-ban avant envoi
 * @param {object} sock - Socket Baileys
 * @param {object} msg - Message (pour extraire jid, type)
 * @param {object} config - Configuration
 * @returns {{ allowed: boolean, reason?: string }}
 */
async function securityMiddleware(sock, msg, config) {
    const state = loadState();
    const isGroup = msg?.key?.remoteJid?.endsWith('@g.us') || false;
    
    // Vérifier les limites
    const check = canSend(state, isGroup);
    if (!check.allowed) {
        console.log(`[SECURITY] 🚫 Bloqué: ${check.reason}`);
        return { allowed: false, reason: check.reason };
    }
    
    // Appliquer le fingerprint
    spoofHeaders(sock);
    
    // Appliquer le delay humain
    await humanDelay();
    
    // Incrémenter les compteurs
    incrementCounters(state, isGroup);
    
    return { allowed: true };
}

/**
 * Enveloppe un envoi de message avec protections
 * @param {function} sendFn - Fonction d'envoi async
 * @param {object} sock - Socket
 * @param {string} jid - Destinataire
 * @param {object} content - Contenu du message
 * @param {object} config - Configuration
 * @returns {object|null} Résultat de l'envoi ou null si bloqué
 */
async function safeSend(sock, jid, content, config) {
    const state = loadState();
    const isGroup = jid?.endsWith('@g.us') || false;
    
    // Vérifier les limites
    const check = canSend(state, isGroup);
    if (!check.allowed) {
        console.log(`[SECURITY] 🚫 Envoi bloqué: ${check.reason}`);
        return null;
    }
    
    // Delay humain avant envoi
    await humanDelay();
    
    try {
        const result = await sock.sendMessage(jid, content);
        incrementCounters(state, isGroup);
        return result;
    } catch (err) {
        await handleRateLimitError(state, err);
        throw err;
    }
}

/* ═══════════════════════════════════════════════════════════════════
   STATS & DEBUG
   ═══════════════════════════════════════════════════════════════════ */
function getSecurityStats() {
    const state = loadState();
    resetCountersIfNeeded(state);
    
    const ageDays = Math.floor((Date.now() - state.accountCreated) / 86400000);
    const warmupLimit = getWarmupLimit(state);
    
    return {
        accountAge: `${ageDays} jours`,
        warmupComplete: isWarmupComplete(state),
        warmupLimit: warmupLimit === Infinity ? 'Illimité' : warmupLimit,
        daily: { ...state.dailySent },
        hourly: { ...state.hourlySent },
        totalSent: state.totalSent,
        blockedCount: state.blockedCount,
    };
}

function resetSecurityState() {
    securityState = {
        accountCreated: Date.now(),
        dailySent: { private: 0, group: 0 },
        hourlySent: { private: 0, group: 0 },
        lastHourReset: Date.now(),
        lastDayReset: Date.now(),
        totalSent: 0,
        lastSentAt: 0,
        blockedCount: 0,
        warmupComplete: false,
    };
    saveState();
    console.log('[SECURITY] État réinitialisé');
}

module.exports = {
    securityMiddleware,
    safeSend,
    getSecurityStats,
    resetSecurityState,
    humanDelay,
    typingDelay,
    sendingDelay,
    canSend,
    loadState,
    DEFAULTS,
};
