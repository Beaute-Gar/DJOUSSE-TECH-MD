'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — SAFE SEND WRAPPER
 * ============================================================
 *
 * Robust message sending with:
 * - Auto-retry with exponential backoff
 * - Circuit breaker pattern
 * - Jitter to avoid thundering herd
 * - Per-JID deduplication
 * - Error classification (retryable vs fatal)
 *
 * ============================================================
 */

const MAX_RETRIES = 3;
const BASE_DELAY = 1000;
const MAX_DELAY = 10000;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_COOLDOWN = 60000;
const DEDUP_WINDOW = 3000;

// Circuit breaker state
let consecutiveFailures = 0;
let circuitOpenUntil = 0;

// Dedup tracking
const recentSends = new Map();

function isDuplicate(jid, content) {
    const key = `${jid}:${content}`;
    const now = Date.now();
    if (recentSends.has(key)) {
        const lastSend = recentSends.get(key);
        if (now - lastSend < DEDUP_WINDOW) return true;
    }
    recentSends.set(key, now);
    // Cleanup old entries
    if (recentSends.size > 1000) {
        for (const [k, v] of recentSends) {
            if (now - v > DEDUP_WINDOW) recentSends.delete(k);
        }
    }
    return false;
}

function isRetryableError(err) {
    const msg = (err?.message || '').toLowerCase();
    const code = err?.output?.statusCode || err?.data?.statusCode || 0;
    // Retryable: rate limits, network, server errors
    if (code === 429 || code === 408 || code === 500 || code === 502 || code === 503 || code === 504) return true;
    if (msg.includes('rate-overlimit') || msg.includes('timed out') || msg.includes('connection') || msg.includes('socket')) return true;
    if (msg.includes('restart') || msg.includes('disconnect')) return true;
    return false;
}

function isFatalError(err) {
    const msg = (err?.message || '').toLowerCase();
    const code = err?.output?.statusCode || err?.data?.statusCode || 0;
    // Fatal: auth, banned, not found
    if (code === 401 || code === 403 || code === 404) return true;
    if (msg.includes('logged out') || msg.includes('banned') || msg.includes('unauthorized')) return true;
    if (msg.includes('not found') || msg.includes('invalid')) return true;
    return false;
}

function getRetryDelay(attempt) {
    const exp = Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_DELAY);
    const jitter = exp * 0.3 * Math.random();
    return Math.floor(exp + jitter);
}

function checkCircuit() {
    if (Date.now() < circuitOpenUntil) {
        return { open: true, remaining: circuitOpenUntil - Date.now() };
    }
    return { open: false };
}

function recordFailure() {
    consecutiveFailures++;
    if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN;
        console.log(`[SAFE-SEND] 🔴 Circuit breaker ouvert pendant ${CIRCUIT_BREAKER_COOLDOWN / 1000}s`);
    }
}

function recordSuccess() {
    consecutiveFailures = 0;
    circuitOpenUntil = 0;
}

async function safeSend(sock, jid, content, options = {}) {
    const { quoted, mentions, dedup = true, retry = true } = options;

    // Circuit breaker check
    const circuit = checkCircuit();
    if (circuit.open) {
        console.log(`[SAFE-SEND] ⏸️ Circuit breaker actif, ${circuit.remaining}ms restantes`);
        return null;
    }

    // Dedup check
    if (dedup) {
        const contentKey = typeof content === 'string' ? content : JSON.stringify(content);
        if (isDuplicate(jid, contentKey)) {
            console.log(`[SAFE-SEND] 🔄 Doublon évité pour ${jid}`);
            return null;
        }
    }

    const maxAttempts = retry ? MAX_RETRIES : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const sendOptions = {};
            if (quoted) sendOptions.quoted = quoted;
            if (mentions) sendOptions.mentions = mentions;

            const result = await sock.sendMessage(jid, content, sendOptions);
            recordSuccess();
            return result;
        } catch (err) {
            if (isFatalError(err)) {
                recordFailure();
                console.error(`[SAFE-SEND] 💀 Erreur fatale: ${err.message}`);
                return null;
            }

            if (attempt < maxAttempts - 1 && isRetryableError(err)) {
                const delay = getRetryDelay(attempt);
                console.log(`[SAFE-SEND] ⏳ Retry ${attempt + 1}/${maxAttempts} dans ${delay}ms: ${err.message}`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }

            recordFailure();
            console.error(`[SAFE-SEND] ❌ Échec après ${attempt + 1} tentatives: ${err.message}`);
            return null;
        }
    }

    return null;
}

function getStats() {
    return {
        consecutiveFailures,
        circuitOpen: Date.now() < circuitOpenUntil,
        circuitRemaining: Math.max(0, circuitOpenUntil - Date.now()),
        recentSendsCount: recentSends.size,
    };
}

module.exports = { safeSend, getStats, checkCircuit };
