'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — ANTI-FLOOD SYSTEM
 * ============================================================
 *
 * Detects and punishes spam/flood in groups.
 * - Tracks messages per user per group
 * - Warns after threshold
 * - Mutes after repeated warnings
 *
 * ============================================================
 */

const TRACKING_WINDOW = 10000;
const WARN_THRESHOLD = 5;
const MUTE_THRESHOLD = 3;
const MUTE_DURATION = 300000;

const floodData = new Map();
const warnCounts = new Map();
const mutedUsers = new Map();

function getKey(groupJid, userJid) {
    return `${groupJid}:${userJid}`;
}

function trackMessage(groupJid, userJid) {
    const key = getKey(groupJid, userJid);
    const now = Date.now();

    if (!floodData.has(key)) floodData.set(key, []);
    const timestamps = floodData.get(key).filter(t => now - t < TRACKING_WINDOW);
    timestamps.push(now);
    floodData.set(key, timestamps);

    if (mutedUsers.has(key)) {
        const muteEnd = mutedUsers.get(key);
        if (now < muteEnd) return { action: 'muted', remaining: muteEnd - now };
        mutedUsers.delete(key);
    }

    if (timestamps.length > WARN_THRESHOLD) {
        const warnKey = key;
        const warns = (warnCounts.get(warnKey) || 0) + 1;
        warnCounts.set(warnKey, warns);

        if (warns >= MUTE_THRESHOLD) {
            const muteEnd = now + MUTE_DURATION;
            mutedUsers.set(key, muteEnd);
            warnCounts.set(warnKey, 0);
            return { action: 'muted', duration: MUTE_DURATION };
        }

        return { action: 'warned', warns, max: MUTE_THRESHOLD };
    }

    return { action: 'ok', count: timestamps.length };
}

function isMuted(groupJid, userJid) {
    const key = getKey(groupJid, userJid);
    if (!mutedUsers.has(key)) return false;
    const muteEnd = mutedUsers.get(key);
    if (Date.now() >= muteEnd) { mutedUsers.delete(key); return false; }
    return true;
}

function getStats() {
    return {
        tracking: floodData.size,
        warned: warnCounts.size,
        muted: mutedUsers.size,
    };
}

function cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of floodData.entries()) {
        const valid = timestamps.filter(t => now - t < TRACKING_WINDOW);
        if (valid.length === 0) floodData.delete(key);
        else floodData.set(key, valid);
    }
    for (const [key, muteEnd] of mutedUsers.entries()) {
        if (now >= muteEnd) mutedUsers.delete(key);
    }
}

setInterval(cleanup, 60000);

module.exports = { trackMessage, isMuted, getStats, cleanup };
