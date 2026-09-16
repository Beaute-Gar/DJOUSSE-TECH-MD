'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — ANTI-BAN SYSTEM (HARDENED)
 * ============================================================
 *
 * Core anti-ban with:
 * - Daily warm-up limits (from warmup.cjs)
 * - Stricter base limits: 10/min, 60/hr, 400/day
 * - Retry with exponential backoff on 429/401
 * - Broadcast blocking during warm-up
 * - All sends through queue
 *
 * ============================================================
 */

const { safeSend } = require('./safesend.cjs');
const presence = require('./presence.cjs');
const warmup = require('./warmup.cjs');

// --- STATE ---
let messageQueue = [];
let isProcessing = false;
let dailyCount = 0;
let dailyResetTimer = null;
let sock = null;

// --- CONFIG (hardened) ---
const CONFIG = {
    maxMessagesPerMinute: 10,
    maxMessagesPerHour: 60,
    maxMessagesPerDay: 400,
    minDelay: 1000,
    maxDelay: 3000,
    typingDuration: { min: 800, max: 2500 },
    retryAttempts: 3,
    retryBaseDelay: 2000,
    retryMaxDelay: 8000,
};

// --- RATE TRACKING ---
const rateWindows = {
    minute: [],
    hour: [],
};

function cleanWindow(arr, windowMs) {
    const now = Date.now();
    while (arr.length > 0 && now - arr[0] > windowMs) arr.shift();
}

function canSend() {
    const now = Date.now();
    cleanWindow(rateWindows.minute, 60000);
    cleanWindow(rateWindows.hour, 3600000);

    // Get limits from daily warm-up schedule
    const limits = warmup.getWarmupLimits();
    const maxPerMin = Math.max(3, Math.floor(limits.maxPerHour / 6));
    const maxPerHour = limits.maxPerHour;
    const maxPerDay = limits.maxPerDay;

    if (rateWindows.minute.length >= maxPerMin) return { ok: false, reason: 'minute_limit' };
    if (rateWindows.hour.length >= maxPerHour) return { ok: false, reason: 'hour_limit' };
    if (dailyCount >= maxPerDay) return { ok: false, reason: 'day_limit' };

    return { ok: true };
}

function recordSend() {
    const now = Date.now();
    rateWindows.minute.push(now);
    rateWindows.hour.push(now);
    dailyCount++;
}

// --- HUMAN-LIKE DELAYS ---
function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getHumanDelay() {
    return randomBetween(CONFIG.minDelay, CONFIG.maxDelay);
}

// --- TYPING SIMULATION ---
async function simulateTyping(jid, textLength = 0) {
    await presence.simulateTyping(jid, textLength);
}

// --- RETRY WITH BACKOFF ---
function getRetryDelay(attempt) {
    const exp = Math.min(CONFIG.retryBaseDelay * Math.pow(2, attempt), CONFIG.retryMaxDelay);
    const jitter = exp * 0.3 * Math.random();
    return Math.floor(exp + jitter);
}

function isRetryableError(err) {
    const code = err?.output?.statusCode || err?.data?.statusCode || 0;
    const msg = (err?.message || '').toLowerCase();
    if (code === 429 || code === 408 || code === 500 || code === 502 || code === 503) return true;
    if (msg.includes('rate-overlimit') || msg.includes('timed out') || msg.includes('restart')) return true;
    return false;
}

function isFatalError(err) {
    const code = err?.output?.statusCode || err?.data?.statusCode || 0;
    const msg = (err?.message || '').toLowerCase();
    if (code === 401 || code === 403) return true;
    if (msg.includes('logged out') || msg.includes('banned') || msg.includes('unauthorized')) return true;
    return false;
}

// --- QUEUE ---
async function processQueue() {
    if (isProcessing || messageQueue.length === 0) return;
    isProcessing = true;

    while (messageQueue.length > 0) {
        const check = canSend();
        if (!check.ok) {
            const waitTime = check.reason === 'minute_limit' ? 60000 : 30000;
            console.log(`[ANTI-BAN] ⏸️ Pause: ${check.reason}, attente ${waitTime / 1000}s...`);
            await new Promise(r => setTimeout(r, waitTime));
            continue;
        }

        const task = messageQueue.shift();
        let success = false;

        for (let attempt = 0; attempt < CONFIG.retryAttempts; attempt++) {
            try {
                await task();
                recordSend();
                success = true;
                break;
            } catch (err) {
                if (isFatalError(err)) {
                    console.error(`[ANTI-BAN] 💀 Erreur fatale: ${err.message}`);
                    break;
                }
                if (attempt < CONFIG.retryAttempts - 1 && isRetryableError(err)) {
                    const delay = getRetryDelay(attempt);
                    console.log(`[ANTI-BAN] ⏳ Retry ${attempt + 1}/${CONFIG.retryAttempts} dans ${delay}ms: ${err.message}`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                console.error(`[ANTI-BAN] ❌ Échec: ${err.message}`);
                break;
            }
        }

        if (messageQueue.length > 0) {
            const delay = getHumanDelay();
            await new Promise(r => setTimeout(r, delay));
        }
    }

    isProcessing = false;
}

// --- BROADCAST CHECK ---
function checkBroadcast() {
    if (!warmup.canBroadcast()) {
        const days = warmup.getDaysSinceBoot();
        console.log(`[ANTI-BAN] 📢 Broadcast bloqué — warm-up jour ${days} (minimum 14 jours)`);
        return false;
    }
    return true;
}

// --- PUBLIC API ---
function init(baileysSock) {
    sock = baileysSock;
    dailyResetTimer = setInterval(() => { dailyCount = 0; }, 86400000);

    const limits = warmup.getWarmupLimits();
    console.log('[ANTI-BAN] 🛡️ Système anti-ban activé (hardened)');
    console.log(`[ANTI-BAN] 📊 Jour ${limits.days}: ${limits.maxPerDay}/j, ${limits.maxPerHour}/h, ~${warmup.getMaxPerMin()}/min`);
    console.log(`[ANTI-BAN] 📢 Broadcast: ${warmup.canBroadcast() ? 'autorisé' : `bloqué (${limits.days}/14 jours)`}`);
}

function queueMessage(fn) {
    messageQueue.push(fn);
    processQueue();
}

function getStats() {
    cleanWindow(rateWindows.minute, 60000);
    cleanWindow(rateWindows.hour, 3600000);
    return {
        minuteCount: rateWindows.minute.length,
        hourCount: rateWindows.hour.length,
        dailyCount,
        queueLength: messageQueue.length,
        warmup: warmup.getStats(),
        safeSend: require('./safesend.cjs').getStats(),
    };
}

function destroy() {
    if (dailyResetTimer) clearInterval(dailyResetTimer);
    messageQueue = [];
    sock = null;
}

module.exports = { init, queueMessage, simulateTyping, canSend, checkBroadcast, getStats, destroy, CONFIG };
