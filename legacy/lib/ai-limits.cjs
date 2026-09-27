'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — AI DAILY LIMITS
 * ============================================================
 *
 * Per-user daily AI command limits:
 * - Default: 20 AI commands/day per user
 * - Owner/Sudo: unlimited
 * - Resets at midnight (Africa/Douala)
 * - Tracks per-service usage (ainoria, gemini, etc.)
 *
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'ai-usage.json');

// Default limits
const DEFAULT_LIMITS = {
    chat: 20,        // AI chat commands
    image: 10,       // Image generation
    analyze: 15,     // Image/video analysis
    translate: 30,   // Translation commands
};

const OWNER_UNLIMITED = true;

// In-memory store
let usageData = {};

// Load from disk
function loadUsage() {
    try {
        if (fs.existsSync(DB_PATH)) {
            usageData = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
        }
    } catch (e) {
        usageData = {};
    }
}

// Save to disk
function saveUsage() {
    try {
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DB_PATH, JSON.stringify(usageData, null, 2));
    } catch (e) {}
}

// Get today's key
function getTodayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Get user usage for today
function getUserUsage(userId) {
    const today = getTodayKey();
    if (!usageData[userId]) usageData[userId] = {};
    if (!usageData[userId][today]) {
        usageData[userId][today] = { chat: 0, image: 0, analyze: 0, translate: 0 };
    }
    return usageData[userId][today];
}

// Check if user can use an AI command
function canUse(userId, service = 'chat', isOwner = false, isSudo = false) {
    if (OWNER_UNLIMITED && (isOwner || isSudo)) {
        return { allowed: true, remaining: Infinity };
    }

    const limits = DEFAULT_LIMITS;
    const max = limits[service] || limits.chat;
    const usage = getUserUsage(userId);
    const used = usage[service] || 0;
    const remaining = Math.max(0, max - used);

    return {
        allowed: remaining > 0,
        remaining,
        used,
        max,
        resetsAt: getNextResetTime(),
    };
}

// Record usage
function recordUsage(userId, service = 'chat') {
    const usage = getUserUsage(userId);
    if (usage[service] !== undefined) {
        usage[service]++;
    } else {
        usage[service] = 1;
    }
    saveUsage();
}

// Get stats for a user
function getStats(userId, isOwner = false, isSudo = false) {
    const usage = getUserUsage(userId);
    const limits = DEFAULT_LIMITS;

    const stats = {};
    for (const [service, max] of Object.entries(limits)) {
        const used = usage[service] || 0;
        stats[service] = {
            used,
            max: (OWNER_UNLIMITED && (isOwner || isSudo)) ? '∞' : max,
            remaining: (OWNER_UNLIMITED && (isOwner || isSudo)) ? '∞' : Math.max(0, max - used),
        };
    }

    return stats;
}

// Get next reset time (midnight Africa/Douala)
function getNextResetTime() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return midnight;
}

// Cleanup old data (keep 7 days)
function cleanup() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;

    for (const userId of Object.keys(usageData)) {
        for (const dateKey of Object.keys(usageData[userId])) {
            if (dateKey < cutoffKey) {
                delete usageData[userId][dateKey];
            }
        }
        if (Object.keys(usageData[userId]).length === 0) {
            delete usageData[userId];
        }
    }
    saveUsage();
}

// Initialize
loadUsage();

// Cleanup every hour
setInterval(cleanup, 3600000);

module.exports = {
    canUse,
    recordUsage,
    getStats,
    getTodayKey,
    getNextResetTime,
    DEFAULT_LIMITS,
};
