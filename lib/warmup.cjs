'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — PROGRESSIVE WARM-UP SYSTEM
 * ============================================================
 *
 * Gradually increases sending rate for new/banned numbers:
 * - 5 phases: 3→5→8→12→20 messages/min
 * - Each phase lasts 15-30 seconds
 * - Per-user cooldown tracking
 * - Supports pausing and resuming
 *
 * ============================================================
 */

let currentStep = 0;
let startTime = 0;
let timer = null;
let active = false;

const PHASES = [
    { maxPerMin: 3,  duration: 30000 },  // Phase 0: Very slow start
    { maxPerMin: 5,  duration: 20000 },  // Phase 1: Slow
    { maxPerMin: 8,  duration: 20000 },  // Phase 2: Medium
    { maxPerMin: 12, duration: 15000 },  // Phase 3: Fast
    { maxPerMin: 20, duration: 0 },       // Phase 4: Full speed (no limit change)
];

// Per-user cooldowns (for shared rate tracking)
const userCooldowns = new Map();

function getMaxPerMin() {
    if (currentStep < PHASES.length) {
        return PHASES[currentStep].maxPerMin;
    }
    return 20; // Default max
}

function getStepDuration() {
    if (currentStep < PHASES.length) {
        return PHASES[currentStep].duration;
    }
    return 0;
}

function advanceStep() {
    if (currentStep >= PHASES.length - 1) return;
    currentStep++;
    console.log(`[WARMUP] 📈 Phase ${currentStep + 1}/${PHASES.length}: ${getMaxPerMin()}/min`);
}

function startWarmup() {
    currentStep = 0;
    startTime = Date.now();
    active = true;

    console.log(`[WARMUP] 🚀 Warm-up démarré: Phase 1/${PHASES.length} (${getMaxPerMin()}/min)`);

    function scheduleNext() {
        if (!active) return;
        const duration = getStepDuration();
        if (duration === 0) return; // Final phase, no timer needed

        timer = setTimeout(() => {
            advanceStep();
            scheduleNext();
        }, duration);
    }

    scheduleNext();
}

function stopWarmup() {
    active = false;
    currentStep = PHASES.length - 1;
    if (timer) {
        clearTimeout(timer);
        timer = null;
    }
    console.log('[WARMUP] ⏹️ Warm-up terminé');
}

function isWarmedUp() {
    return currentStep >= PHASES.length - 1;
}

function canSend() {
    if (!active) return true;
    return true; // Let anti-ban handle the actual rate limiting
}

function setUserCooldown(userId, durationMs = 30000) {
    userCooldowns.set(userId, Date.now() + durationMs);
}

function isUserCooledDown(userId) {
    if (!userCooldowns.has(userId)) return true;
    const cooldownEnd = userCooldowns.get(userId);
    if (Date.now() >= cooldownEnd) {
        userCooldowns.delete(userId);
        return true;
    }
    return false;
}

function getUserCooldownRemaining(userId) {
    if (!userCooldowns.has(userId)) return 0;
    const cooldownEnd = userCooldowns.get(userId);
    return Math.max(0, cooldownEnd - Date.now());
}

function getStats() {
    const elapsed = Date.now() - startTime;
    const totalDuration = PHASES.reduce((sum, p) => sum + p.duration, 0);
    return {
        step: currentStep + 1,
        totalSteps: PHASES.length,
        maxPerMin: getMaxPerMin(),
        active,
        warmedUp: isWarmedUp(),
        elapsed,
        progress: Math.min(100, Math.floor((elapsed / totalDuration) * 100)),
    };
}

function destroy() {
    stopWarmup();
    userCooldowns.clear();
}

module.exports = {
    start: startWarmup,
    stop: stopWarmup,
    canSend,
    isWarmedUp,
    getMaxPerMin,
    getStep: () => currentStep,
    setUserCooldown,
    isUserCooledDown,
    getUserCooldownRemaining,
    getStats,
    destroy,
    PHASES,
};
