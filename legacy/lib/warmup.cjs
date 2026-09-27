'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — PROGRESSIVE WARM-UP (DAILY SCHEDULE)
 * ============================================================
 *
 * Gradual warm-up based on days since first boot:
 * - Day 0: 10 msgs/day, 5/hr
 * - Day 3: 25/day, 10/hr
 * - Day 7: 50/day, 15/hr
 * - Day 14: 100/day, 30/hr
 * - Day 30: 400/day, 60/hr (full speed)
 *
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', 'database', 'warmup-state.json');

const WARMUP_SCHEDULE = [
    { day: 0,  maxPerDay: 10,  maxPerHour: 5  },
    { day: 3,  maxPerDay: 25,  maxPerHour: 10 },
    { day: 7,  maxPerDay: 50,  maxPerHour: 15 },
    { day: 14, maxPerDay: 100, maxPerHour: 30 },
    { day: 30, maxPerDay: 400, maxPerHour: 60 },
];

function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        }
    } catch (e) {}
    return null;
}

function saveState(state) {
    try {
        const dir = path.dirname(STATE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (e) {}
}

function getFirstBootDate() {
    const state = loadState();
    if (state?.firstBoot) return state.firstBoot;
    const now = Date.now();
    saveState({ firstBoot: now });
    console.log(`[WARMUP] 📅 First boot date set: ${new Date(now).toISOString()}`);
    return now;
}

function getDaysSinceBoot() {
    const firstBoot = getFirstBootDate();
    return Math.floor((Date.now() - firstBoot) / 86400000);
}

function getWarmupLimits() {
    const days = getDaysSinceBoot();
    let stage = WARMUP_SCHEDULE[0];
    for (const s of WARMUP_SCHEDULE) {
        if (days >= s.day) stage = s;
    }
    return { ...stage, days };
}

function getMaxPerMin() {
    const limits = getWarmupLimits();
    // Approximate per-minute from per-hour
    return Math.max(3, Math.floor(limits.maxPerHour / 6));
}

function canBroadcast() {
    const days = getDaysSinceBoot();
    return days >= 14;
}

function getStats() {
    const limits = getWarmupLimits();
    return {
        days: limits.days,
        maxPerDay: limits.maxPerDay,
        maxPerHour: limits.maxPerHour,
        maxPerMin: getMaxPerMin(),
        canBroadcast: canBroadcast(),
        schedule: WARMUP_SCHEDULE,
    };
}

module.exports = { getWarmupLimits, getMaxPerMin, canBroadcast, getDaysSinceBoot, getFirstBootDate, getStats, WARMUP_SCHEDULE };
