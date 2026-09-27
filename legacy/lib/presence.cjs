'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — HUMAN PRESENCE SIMULATION
 * ============================================================
 *
 * Simulates realistic human presence patterns:
 * - Typing duration based on message length
 * - Random pauses between messages
 * - Recording presence for voice/audio
 * - Composing presence for text
 * - Extended pauses for longer messages
 *
 * ============================================================
 */

let sock = null;

// --- Typing duration models (characters per minute realistic) ---
const TYPING_SPEEDS = {
    fast: { cpm: 80, probability: 0.3 },     // Short messages, quick typer
    normal: { cpm: 50, probability: 0.5 },   // Average typing speed
    slow: { cpm: 30, probability: 0.2 },     // Careful thinker
};

// --- Message length brackets ---
function getTypingDuration(textLength) {
    if (textLength <= 0) return 0;

    const rand = Math.random();
    let selectedSpeed;
    let cumulative = 0;

    for (const [speed, config] of Object.entries(TYPING_SPEEDS)) {
        cumulative += config.probability;
        if (rand <= cumulative) {
            selectedSpeed = config;
            break;
        }
    }
    if (!selectedSpeed) selectedSpeed = TYPING_SPEEDS.normal;

    const baseMs = (textLength / selectedSpeed.cpm) * 60000;

    // Add realistic variance (+-20%)
    const variance = baseMs * 0.2;
    const jitter = (Math.random() - 0.5) * 2 * variance;

    // Bracket: minimum 800ms, maximum 8000ms
    return Math.max(800, Math.min(8000, Math.floor(baseMs + jitter)));
}

// --- Random human pauses ---
function getHumanPause() {
    const pauses = [
        { min: 200, max: 600, weight: 0.4 },    // Quick pause
        { min: 600, max: 1500, weight: 0.3 },    // Normal pause
        { min: 1500, max: 3000, weight: 0.2 },   // Thinking pause
        { min: 3000, max: 5000, weight: 0.1 },   // Distracted pause
    ];

    const rand = Math.random();
    let cumulative = 0;
    for (const p of pauses) {
        cumulative += p.weight;
        if (rand <= cumulative) {
            return Math.floor(Math.random() * (p.max - p.min + 1)) + p.min;
        }
    }
    return Math.floor(Math.random() * 600) + 200;
}

// --- Core presence functions ---
async function simulateTyping(jid, textLength = 0) {
    if (!sock || !jid) return;
    try {
        await sock.sendPresenceUpdate('composing', jid);
        const duration = textLength > 0
            ? getTypingDuration(textLength)
            : Math.floor(Math.random() * 2000) + 800;
        await new Promise(r => setTimeout(r, duration));
        await sock.sendPresenceUpdate('paused', jid);
    } catch (_) {}
}

async function simulateRecording(jid, durationMs = null) {
    if (!sock || !jid) return;
    try {
        await sock.sendPresenceUpdate('recording', jid);
        const duration = durationMs || Math.floor(Math.random() * 5000) + 2000;
        await new Promise(r => setTimeout(r, duration));
        await sock.sendPresenceUpdate('paused', jid);
    } catch (_) {}
}

async function simulateOnline(jid) {
    if (!sock || !jid) return;
    try {
        await sock.sendPresenceUpdate('available', jid);
    } catch (_) {}
}

async function simulateOffline(jid) {
    if (!sock || !jid) return;
    try {
        await sock.sendPresenceUpdate('unavailable', jid);
    } catch (_) {}
}

// --- Combined presence sequence ---
async function typingSequence(jid, textLength = 0) {
    if (!sock || !jid) return;

    // Small initial pause (as if reading the message)
    const readPause = Math.floor(Math.random() * 500) + 200;
    await new Promise(r => setTimeout(r, readPause));

    // Simulate typing
    await simulateTyping(jid, textLength);

    // Small pause after typing (as if reviewing)
    const reviewPause = Math.floor(Math.random() * 300) + 100;
    await new Promise(r => setTimeout(r, reviewPause));
}

function init(baileysSock) {
    sock = baileysSock;
    console.log('[PRESENCE] 🟢 Human presence simulation active');
}

function destroy() {
    sock = null;
}

module.exports = {
    init,
    destroy,
    simulateTyping,
    simulateRecording,
    simulateOnline,
    simulateOffline,
    typingSequence,
    getTypingDuration,
    getHumanPause,
};
