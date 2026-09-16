'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — ANTI-BAN SYSTEM
 * ============================================================
 *
 * Protects the bot from WhatsApp bans by:
 * - Rate limiting messages per minute
 * - Adding human-like random delays
 * - Simulating typing before sending
 * - Warm-up ramp (start slow, increase speed)
 * - Tracking daily message count
 *
 * ============================================================
 */

// --- STATE ---
let messageQueue = [];
let isProcessing = false;
let dailyCount = 0;
let dailyResetTimer = null;
let warmupStep = 0;
let sock = null;

// --- CONFIG ---
const CONFIG = {
    maxMessagesPerMinute: 20,
    maxMessagesPerHour: 200,
    maxMessagesPerDay: 1000,
    minDelay: 1000,
    maxDelay: 3000,
    typingDuration: { min: 800, max: 2500 },
    warmupSteps: [
        { duration: 5000, maxPerMin: 5 },
        { duration: 3000, maxPerMin: 10 },
        { duration: 2000, maxPerMin: 15 },
        { duration: 1000, maxPerMin: 20 },
    ],
    warmupDuration: 60000,
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

    if (rateWindows.minute.length >= getRateLimit()) return { ok: false, reason: 'minute_limit' };
    if (rateWindows.hour.length >= CONFIG.maxMessagesPerHour) return { ok: false, reason: 'hour_limit' };
    if (dailyCount >= CONFIG.maxMessagesPerDay) return { ok: false, reason: 'day_limit' };

    return { ok: true };
}

function getRateLimit() {
    if (warmupStep < CONFIG.warmupSteps.length) {
        return CONFIG.warmupSteps[warmupStep].maxPerMin;
    }
    return CONFIG.maxMessagesPerMinute;
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
async function simulateTyping(jid) {
    if (!sock || !jid) return;
    try {
        await sock.sendPresenceUpdate('composing', jid);
        const typingMs = randomBetween(CONFIG.typingDuration.min, CONFIG.typingDuration.max);
        await new Promise(r => setTimeout(r, typingMs));
        await sock.sendPresenceUpdate('paused', jid);
    } catch (_) {}
}

// --- WARM-UP ---
function startWarmup() {
    warmupStep = 0;
    const stepDuration = CONFIG.warmupDuration / CONFIG.warmupSteps.length;
    const interval = setInterval(() => {
        warmupStep++;
        if (warmupStep >= CONFIG.warmupSteps.length) {
            clearInterval(interval);
        }
    }, stepDuration);
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
        try {
            await task();
            recordSend();
        } catch (err) {
            console.error('[ANTI-BAN] ❌ Erreur envoi:', err.message);
        }

        if (messageQueue.length > 0) {
            const delay = getHumanDelay();
            await new Promise(r => setTimeout(r, delay));
        }
    }

    isProcessing = false;
}

// --- PUBLIC API ---
function init(baileysSock) {
    sock = baileysSock;
    startWarmup();
    dailyResetTimer = setInterval(() => { dailyCount = 0; }, 86400000);
    console.log('[ANTI-BAN] 🛡️ Système anti-ban activé');
    console.log(`[ANTI-BAN] 📊 Limites: ${CONFIG.maxMessagesPerMinute}/min, ${CONFIG.maxMessagesPerHour}/h, ${CONFIG.maxMessagesPerDay}/j`);
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
        rateLimit: getRateLimit(),
        warmupStep,
    };
}

function destroy() {
    if (dailyResetTimer) clearInterval(dailyResetTimer);
    messageQueue = [];
    sock = null;
}

module.exports = { init, queueMessage, simulateTyping, canSend, getStats, destroy, CONFIG };
