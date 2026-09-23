'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — STATUS ROTATOR
 * ============================================================
 *
 * Publishes a quote to the bot's own WhatsApp status, 2×/day max.
 * Uses the statusQuotes config pool.
 *
 * ============================================================
 */

const config = require('../config');

let sock = null;
let lastPostDate = null;
let postCount = 0;

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function canPost() {
    const now = new Date();
    const today = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

    if (lastPostDate !== today) {
        lastPostDate = today;
        postCount = 0;
    }

    return postCount < 2; // Max 2 per day
}

function getRandomQuote() {
    // Try to use statusQuotes from config, or fallback to a default pool
    const defaults = [
        'La vie est belle quand on prend le temps de la vivre.',
        'Chaque jour est une nouvelle chance de devenir meilleur.',
        'Le succès ne vient pas à ceux qui attendent, il vient à ceux qui agissent.',
        'La persévérance est la clé de tous les succès.',
        'Ne comparaison pas ta vie à celle des autres. Tu ne connais pas leur parcours.',
        'Le plus grand risque est de ne prendre aucun risque.',
        'La technologie est un outil puissant, mais c\'est l\'humain qui fait la différence.',
        'Investir en soi-même est le meilleur investissement.',
        'La patience est une vertu, surtout quand on construit quelque chose de grand.',
        'Chaque expert a déjà été un débutant.',
    ];

    if (config.statusQuotes?.source) {
        // Could fetch from API, but keep it simple with defaults
    }

    return defaults[Math.floor(Math.random() * defaults.length)];
}

async function postStatus() {
    if (!sock || !sock.user) return;
    if (!canPost()) return;

    const quote = getRandomQuote();
    const now = new Date();
    const timeStr = now.toLocaleTimeString('fr-FR', { timeZone: 'Africa/Douala', hour: '2-digit', minute: '2-digit' });

    const text = `💫 *${config.botName || 'DJOUSSE TECH'}*\n\n${quote}\n\n⏰ ${timeStr}`;

    try {
        await sock.sendMessage('status@broadcast', { text });
        postCount++;
        console.log(`[STATUS] 📢 Status posté (${postCount}/2 aujourd'hui)`);
    } catch (e) {
        console.log('[STATUS] ❌ Échec post status:', e.message);
    }
}

let rotatorInterval = null;

function startRotator(getSock) {
    // Idempotent : un seul timer, survit aux reconnexions via getSock()
    if (rotatorInterval) clearInterval(rotatorInterval);
    // Post every 12h (roughly 2×/day)
    rotatorInterval = setInterval(() => {
        sock = getSock();
        if (sock?.user) {
            postStatus();
        }
    }, 12 * 60 * 60 * 1000);

    console.log('[STATUS] 🟢 Rotateur de statut actif (2×/jour max)');
}

function destroy() {
    if (rotatorInterval) {
        clearInterval(rotatorInterval);
        rotatorInterval = null;
    }
    sock = null;
}

module.exports = { startRotator, destroy, postStatus };
