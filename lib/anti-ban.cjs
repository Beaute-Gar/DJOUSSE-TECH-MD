'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — ANTI-BAN SYSTEM (HARDENED)
 * ============================================================
 *
 * Core anti-ban with:
 * - Daily warm-up limits (from warmup.cjs)
 * - Status & Channel publish quotas
 * - Human-like delays
 * - Restriction auto-detection (401/403/440)
 * - Queue system with retry + backoff
 * - Premium formatted status report
 *
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const warmup = require('./warmup.cjs');

// ─── Paths ─────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '..', 'database');
const RESTRICTED_FLAG = path.join(DATA_DIR, 'RESTRICTED.flag');
const QUOTA_FILE = path.join(DATA_DIR, 'anti-ban-quota.json');

// ─── STATE ─────────────────────────────────────────────
let messageQueue = [];
let isProcessing = false;
let dailyCount = 0;
let dailyResetTimer = null;
let sock = null;

// Rate tracking
const rateWindows = { minute: [], hour: [] };

// Status/Channel tracking
let lastStatusTimestamp = 0;
let lastChannelTimestamp = 0;

// ─── CONFIG ────────────────────────────────────────────
const CONFIG = {
    maxMessagesPerMinute: 10,
    maxMessagesPerHour: 60,
    maxMessagesPerDay: 400,
    minDelay: 1500,
    maxDelay: 4000,
    typingDuration: { min: 800, max: 2500 },
    retryAttempts: 3,
    retryBaseDelay: 2000,
    retryMaxDelay: 8000,
    minHoursBetweenStatus: 2,
    minHoursBetweenChannelPosts: 4,
};

// ═══════════════════════════════════════════════════════
// LOGGING
// ═══════════════════════════════════════════════════════

function log(msg) { console.log(`[ANTI-BAN] ${msg}`); }
function logError(msg) { console.error(`[ANTI-BAN] ERROR: ${msg}`); }

// ═══════════════════════════════════════════════════════
// PERSISTANCE
// ═══════════════════════════════════════════════════════

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadQuota() {
    try {
        ensureDataDir();
        if (!fs.existsSync(QUOTA_FILE)) {
            const init = { date: new Date().toISOString().slice(0, 10), messages: 0, status: 0, channel: 0 };
            fs.writeFileSync(QUOTA_FILE, JSON.stringify(init, null, 2), 'utf8');
            return init;
        }
        return JSON.parse(fs.readFileSync(QUOTA_FILE, 'utf8'));
    } catch {
        return { date: new Date().toISOString().slice(0, 10), messages: 0, status: 0, channel: 0 };
    }
}

function saveQuota(quota) {
    try {
        ensureDataDir();
        fs.writeFileSync(QUOTA_FILE, JSON.stringify(quota, null, 2), 'utf8');
    } catch (e) {
        logError(`Erreur écriture quota: ${e.message}`);
    }
}

// ═══════════════════════════════════════════════════════
// DAILY RESET
// ═══════════════════════════════════════════════════════

function checkDailyReset() {
    const today = new Date().toISOString().slice(0, 10);
    const quota = loadQuota();
    if (quota.date !== today) {
        quota.date = today;
        quota.messages = 0;
        quota.status = 0;
        quota.channel = 0;
        saveQuota(quota);
        log(`📅 Reset journalier (${today})`);
    }
    return quota;
}

// ═══════════════════════════════════════════════════════
// RESTRICTION DETECTION
// ═══════════════════════════════════════════════════════

function isRestricted() {
    return fs.existsSync(RESTRICTED_FLAG);
}

function setRestricted(reason, code) {
    try {
        ensureDataDir();
        fs.writeFileSync(RESTRICTED_FLAG, JSON.stringify({
            at: new Date().toISOString(),
            reason,
            code,
        }, null, 2), 'utf8');
        logError(`🚨 COMPTE RESTREINT — ${reason} (code ${code})`);
    } catch (e) {
        logError(`Erreur écriture flag: ${e.message}`);
    }
}

function clearRestricted() {
    try {
        if (fs.existsSync(RESTRICTED_FLAG)) {
            fs.unlinkSync(RESTRICTED_FLAG);
            log(`✅ Flag restriction supprimé`);
        }
    } catch (e) {
        logError(`Erreur suppression flag: ${e.message}`);
    }
}

// ═══════════════════════════════════════════════════════
// RATE CHECKING
// ═══════════════════════════════════════════════════════

function cleanWindow(arr, windowMs) {
    const now = Date.now();
    while (arr.length > 0 && now - arr[0] > windowMs) arr.shift();
}

function canSend() {
    if (isRestricted()) return { ok: false, reason: 'restricted' };

    const now = Date.now();
    cleanWindow(rateWindows.minute, 60000);
    cleanWindow(rateWindows.hour, 3600000);

    const limits = warmup.getWarmupLimits();
    const maxPerMin = Math.max(3, Math.floor(limits.maxPerHour / 6));
    const quota = checkDailyReset();

    if (rateWindows.minute.length >= maxPerMin) return { ok: false, reason: 'minute_limit' };
    if (rateWindows.hour.length >= limits.maxPerHour) return { ok: false, reason: 'hour_limit' };
    if (quota.messages >= limits.maxPerDay) return { ok: false, reason: 'day_limit' };

    return { ok: true };
}

function canPublishStatus() {
    if (isRestricted()) return { ok: false, reason: 'restricted' };

    const now = Date.now();
    const hoursSinceLast = (now - lastStatusTimestamp) / 3600000;
    if (lastStatusTimestamp > 0 && hoursSinceLast < CONFIG.minHoursBetweenStatus) {
        const wait = Math.ceil(CONFIG.minHoursBetweenStatus - hoursSinceLast);
        return { ok: false, reason: `Attends ${wait}h avant le prochain statut` };
    }

    const limits = warmup.getWarmupLimits();
    const quota = checkDailyReset();
    const maxStatus = limits.days >= 14 ? 4 : limits.days >= 7 ? 3 : limits.days >= 3 ? 2 : 1;
    if (quota.status >= maxStatus) {
        return { ok: false, reason: `Quota statut atteint (${quota.status}/${maxStatus})` };
    }

    return { ok: true };
}

function canPublishChannel() {
    if (isRestricted()) return { ok: false, reason: 'restricted' };

    const now = Date.now();
    const hoursSinceLast = (now - lastChannelTimestamp) / 3600000;
    if (lastChannelTimestamp > 0 && hoursSinceLast < CONFIG.minHoursBetweenChannelPosts) {
        const wait = Math.ceil(CONFIG.minHoursBetweenChannelPosts - hoursSinceLast);
        return { ok: false, reason: `Attends ${wait}h avant le prochain post chaîne` };
    }

    const limits = warmup.getWarmupLimits();
    const quota = checkDailyReset();
    const maxChannel = limits.days >= 14 ? 3 : limits.days >= 7 ? 2 : limits.days >= 3 ? 1 : 0;
    if (quota.channel >= maxChannel) {
        return { ok: false, reason: `Quota chaîne atteint (${quota.channel}/${maxChannel})` };
    }

    return { ok: true };
}

// ═══════════════════════════════════════════════════════
// RECORDING
// ═══════════════════════════════════════════════════════

function recordSend() {
    const now = Date.now();
    rateWindows.minute.push(now);
    rateWindows.hour.push(now);
    dailyCount++;
    const quota = checkDailyReset();
    quota.messages++;
    saveQuota(quota);
}

function recordStatus() {
    lastStatusTimestamp = Date.now();
    const quota = checkDailyReset();
    quota.status++;
    saveQuota(quota);
}

function recordChannelPost() {
    lastChannelTimestamp = Date.now();
    const quota = checkDailyReset();
    quota.channel++;
    saveQuota(quota);
}

// ═══════════════════════════════════════════════════════
// HUMAN-LIKE DELAYS
// ═══════════════════════════════════════════════════════

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getHumanDelay() {
    return randomBetween(CONFIG.minDelay, CONFIG.maxDelay);
}

async function humanDelay(sock, jid, minMs = 1500, maxMs = 4000) {
    const delay = randomBetween(minMs, maxMs);
    await new Promise(r => setTimeout(r, delay));

    if (sock && jid) {
        try {
            await sock.sendPresenceUpdate('composing', jid);
            await new Promise(r => setTimeout(r, randomBetween(1000, 3000)));
            await sock.sendPresenceUpdate('paused', jid);
        } catch {}
    }
}

async function randomDelay(minMs = 2000, maxMs = 8000) {
    await new Promise(r => setTimeout(r, randomBetween(minMs, maxMs)));
}

// ═══════════════════════════════════════════════════════
// RETRY WITH BACKOFF
// ═══════════════════════════════════════════════════════

function getRetryDelay(attempt) {
    const exp = Math.min(CONFIG.retryBaseDelay * Math.pow(2, attempt), CONFIG.retryMaxDelay);
    const jitter = exp * 0.3 * Math.random();
    return Math.floor(exp + jitter);
}

function isRetryableError(err) {
    const code = err?.output?.statusCode || err?.data?.statusCode || 0;
    const msg = (err?.message || '').toLowerCase();
    if ([429, 408, 500, 502, 503].includes(code)) return true;
    if (msg.includes('rate-overlimit') || msg.includes('timed out') || msg.includes('restart')) return true;
    return false;
}

function isFatalError(err) {
    const code = err?.output?.statusCode || err?.data?.statusCode || 0;
    const msg = (err?.message || '').toLowerCase();
    if ([401, 403].includes(code)) return true;
    if (msg.includes('logged out') || msg.includes('banned') || msg.includes('unauthorized')) return true;
    return false;
}

// ═══════════════════════════════════════════════════════
// QUEUE
// ═══════════════════════════════════════════════════════

async function processQueue() {
    if (isProcessing || messageQueue.length === 0) return;
    isProcessing = true;

    while (messageQueue.length > 0) {
        const check = canSend();
        if (!check.ok) {
            if (check.reason === 'restricted') {
                logError('🚨 Arrêt queue — compte restreint');
                messageQueue = [];
                break;
            }
            const waitTime = check.reason === 'minute_limit' ? 60000 : 30000;
            log(`⏸️ Pause: ${check.reason}, attente ${waitTime / 1000}s...`);
            await new Promise(r => setTimeout(r, waitTime));
            continue;
        }

        const task = messageQueue.shift();

        for (let attempt = 0; attempt < CONFIG.retryAttempts; attempt++) {
            try {
                await task();
                recordSend();
                break;
            } catch (err) {
                if (isFatalError(err)) {
                    logError(`💀 Erreur fatale: ${err.message}`);
                    if ([401, 403].includes(err?.output?.statusCode)) {
                        setRestricted(err.message, err.output.statusCode);
                        process.emit('whatsapp:stop-all', { reason: err.message });
                    }
                    break;
                }
                if (attempt < CONFIG.retryAttempts - 1 && isRetryableError(err)) {
                    const delay = getRetryDelay(attempt);
                    log(`⏳ Retry ${attempt + 1}/${CONFIG.retryAttempts} dans ${delay}ms`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                logError(`❌ Échec: ${err.message}`);
                break;
            }
        }

        if (messageQueue.length > 0) {
            await new Promise(r => setTimeout(r, getHumanDelay()));
        }
    }

    isProcessing = false;
}

// ═══════════════════════════════════════════════════════
// BROADCAST CHECK
// ═══════════════════════════════════════════════════════

function checkBroadcast() {
    if (!warmup.canBroadcast()) {
        const days = warmup.getDaysSinceBoot();
        log(`📢 Broadcast bloqué — warm-up jour ${days} (minimum 14 jours)`);
        return false;
    }
    return true;
}

// ═══════════════════════════════════════════════════════
// STATUS REPORT (Premium)
// ═══════════════════════════════════════════════════════

function formatStatusReport() {
    const limits = warmup.getWarmupLimits();
    const quota = checkDailyReset();
    const days = limits.days;

    const maxStatus = days >= 14 ? 4 : days >= 7 ? 3 : days >= 3 ? 2 : 1;
    const maxChannel = days >= 14 ? 3 : days >= 7 ? 2 : days >= 3 ? 1 : 0;

    const restrictedLine = isRestricted()
        ? `  ▸ Statut      ·  🚨 RESTREINT`
        : `  ▸ Statut      ·  ✅ Actif`;

    return `✦ ─────────────── ✦
   🛡️  A N T I - B A N
✦ ─────────────── ✦

${restrictedLine}
  ▸ Jour warmup ·  ${days} / 30
  ▸ Phase       ·  ${limits.maxPerDay} msg/j | ${limits.maxPerHour}/h

✦ ─────────────── ✦
   📊  A U J O U R D ' H U I
✦ ─────────────── ✦

  ▸ Messages    ·  ${quota.messages} / ${limits.maxPerDay}
  ▸ Statuts     ·  ${quota.status} / ${maxStatus}
  ▸ Chaîne      ·  ${quota.channel} / ${maxChannel}
  ▸ Dernière h  ·  ${rateWindows.hour.length} / ${limits.maxPerHour}

✦ ─────────────── ✦
> ✦ DJOUSSE TECH ✦`;
}

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

function init(baileysSock) {
    sock = baileysSock;
    if (dailyResetTimer) clearInterval(dailyResetTimer);
    dailyResetTimer = setInterval(() => { dailyCount = 0; }, 86400000);

    const limits = warmup.getWarmupLimits();
    log('🛡️ Système anti-ban activé (hardened)');
    log(`📊 Jour ${limits.days}: ${limits.maxPerDay}/j, ${limits.maxPerHour}/h`);
    log(`📢 Broadcast: ${warmup.canBroadcast() ? 'autorisé' : `bloqué (${limits.days}/14j)`}`);
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
        restricted: isRestricted(),
        warmup: warmup.getStats(),
    };
}

function resetWarmup() {
    warmup.resetWarmup();
    clearRestricted();
    const quota = loadQuota();
    quota.messages = 0;
    quota.status = 0;
    quota.channel = 0;
    saveQuota(quota);
    log('🔄 Warmup reset — jour 1');
}

function destroy() {
    if (dailyResetTimer) clearInterval(dailyResetTimer);
    messageQueue = [];
    sock = null;
}

module.exports = {
    init,
    queueMessage,
    canSend,
    canPublishStatus,
    canPublishChannel,
    recordSend,
    recordStatus,
    recordChannelPost,
    humanDelay,
    randomDelay,
    checkBroadcast,
    getStats,
    formatStatusReport,
    resetWarmup,
    isRestricted,
    setRestricted,
    clearRestricted,
    destroy,
    CONFIG,
};
