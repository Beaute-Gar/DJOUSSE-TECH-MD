'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — AUTO-REACT STATUS (HARDENED)
 * ============================================================
 *
 * Listens for incoming status broadcasts and reacts:
 * - Random order (shuffle)
 * - Max 12 reactions per cycle
 * - Random delay 4-12s between each
 * - Interval 25-50 min between cycles
 * - Respects warm-up limits
 *
 * ============================================================
 */

const crypto = require('crypto');
const emoticons = ['❤️', '🔥', '👍', '😂', '😍', '😮', '😢', '🙏', '💪', '🎉', '💯', '✨', '🫶', '😎'];

let sock = null;
let listenerInstalled = false;
let cycleTimer = null;
let pendingStatuses = [];

function shuffleArray(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function processStatusCycle() {
    if (!sock || pendingStatuses.length === 0) return;

    // Shuffle and limit to 12
    const batch = shuffleArray(pendingStatuses).slice(0, 12);
    pendingStatuses = [];

    const emoji = emoticons[Math.floor(Math.random() * emoticons.length)];

    for (const s of batch) {
        try {
            // Read the status first
            await sock.readMessages([{
                remoteJid: s.key.remoteJid,
                fromMe: false,
                id: s.key.id,
                participant: s.key.participant,
            }]).catch(() => {});

            // Random delay 4-12s before reacting
            await new Promise(r => setTimeout(r, randomBetween(4000, 12000)));

            // React
            await sock.sendMessage(
                'status@broadcast',
                { react: { text: emoji, key: s.key } }
            ).catch(() => {});

            console.log('[AUTO-REACT] ✅', emoji, '|', s.key.participant || 'unknown');
        } catch (err) {
            // Silent fail
        }

        // Random delay between statuses
        if (batch.indexOf(s) < batch.length - 1) {
            await new Promise(r => setTimeout(r, randomBetween(2000, 5000)));
        }
    }

    // Schedule next cycle: 25-50 min
    const nextCycle = randomBetween(25 * 60 * 1000, 50 * 60 * 1000);
    cycleTimer = setTimeout(processStatusCycle, nextCycle);
    console.log(`[AUTO-REACT] ⏰ Prochain cycle dans ${Math.floor(nextCycle / 60000)}min`);
}

function init(whatsappSocket) {
    if (!whatsappSocket) throw new Error('autoreact.init(): socket WhatsApp obligatoire');
    sock = whatsappSocket;

    if (listenerInstalled) return;

    if (!sock.ev || typeof sock.ev.on !== 'function') {
        throw new Error('Événement Baileys indisponible');
    }

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            let mek = chatUpdate.messages?.[0];
            if (!mek?.message) return;

            // Unwrap ephemeral messages
            if (mek.message.ephemeralMessage) {
                mek = { ...mek, message: mek.message.ephemeralMessage.message };
            }

            // Only process status@broadcast
            if (mek.key?.remoteJid !== 'status@broadcast') return;

            // Skip own status
            if (mek.key?.fromMe) return;

            // Collect for batch processing
            pendingStatuses.push(mek);

            // If this is the first status in a while, start the cycle
            if (!cycleTimer) {
                // Small delay to collect more statuses
                setTimeout(processStatusCycle, 5000);
            }
        } catch (err) {
            // Silent fail
        }
    });

    listenerInstalled = true;
    console.log('[AUTO-REACT] 🟢 Listener status activé (hardened)');
}

function destroy() {
    listenerInstalled = false;
    if (cycleTimer) {
        clearTimeout(cycleTimer);
        cycleTimer = null;
    }
    pendingStatuses = [];
    sock = null;
}

module.exports = { init, destroy };
