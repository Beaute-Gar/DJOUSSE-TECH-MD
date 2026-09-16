'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — ANTI-BAN SYSTEM
 * ============================================================
 *
 * Core anti-ban with rate limiting, queue, and integration
 * with presence, warmup, and safeSend modules.
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

// --- CONFIG ---
const CONFIG = {
    maxMessagesPerMinute: 20,
    maxMessagesPerHour: 200,
    maxMessagesPerDay: 1000,
    minDelay: 1000,
    maxDelay: 3000,
    typingDuration: { min: 800, max: 2500 },
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

    const maxPerMin = warmup.getMaxPerMin ? warmup.getMaxPerMin() : CONFIG.maxMessagesPerMinute;
    if (rateWindows.minute.length >= maxPerMin) return { ok: false, reason: 'minute_limit' };
    if (rateWindows.hour.length >= CONFIG.maxMessagesPerHour) return { ok: false, reason: 'hour_limit' };
    if (dailyCount >= CONFIG.maxMessagesPerDay) return { ok: false, reason: 'day_limit' };

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

// --- TYPING SIMULATION (delegates to presence module) ---
async function simulateTyping(jid, textLength = 0) {
    await presence.simulateTyping(jid, textLength);
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
        warmup: warmup.getStats ? warmup.getStats() : null,
        safeSend: require('./safesend.cjs').getStats(),
    };
}

function destroy() {
    if (dailyResetTimer) clearInterval(dailyResetTimer);
    messageQueue = [];
    sock = null;
}

module.exports = { init, queueMessage, simulateTyping, canSend, getStats, destroy, CONFIG };
