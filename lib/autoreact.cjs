'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — AUTO-REACT STATUS
 * ============================================================
 *
 * Auto-reacts to WhatsApp status updates with:
 * - Multiple emoji choices
 * - Proper statusJidList for Baileys 6.7.9
 * - Safe retry on failure
 * - Random delay to avoid detection
 *
 * Based on iluser/autoreact-whatsapp, adapted for DJOUSSE TECH
 * ============================================================
 */

const emoticons = ['❤️', '🔥', '👍', '😂', '😍', '😮', '😢', '🙏', '💪', '🎉', '💯', '✨', '🫶', '😎'];

let sock = null;
let listenerInstalled = false;

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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

            // Read the status first (mark as seen)
            await sock.readMessages([mek.key]).catch(() => {});

            // Random delay before reacting (500-2500ms)
            const delay = randomBetween(500, 2500);
            await new Promise(r => setTimeout(r, delay));

            // Pick random emoji
            const randomEmoticon = emoticons[Math.floor(Math.random() * emoticons.length)];

            // Build statusJidList — must include the status poster
            const statusJidList = [];
            if (mek.key.participant) {
                statusJidList.push(mek.key.participant);
            }
            if (sock.user?.id) {
                statusJidList.push(sock.user.id);
            }

            // Try sending reaction with statusJidList
            try {
                await sock.sendMessage(
                    mek.key.remoteJid,
                    { react: { key: mek.key, text: randomEmoticon } },
                    { statusJidList }
                );
                console.log('[AUTO-REACT] ✅', randomEmoticon, '|', mek.key.participant || 'unknown');
            } catch (reactErr) {
                // Retry without statusJidList (some Baileys versions don't need it)
                try {
                    await sock.sendMessage(
                        mek.key.remoteJid,
                        { react: { key: mek.key, text: randomEmoticon } }
                    );
                    console.log('[AUTO-REACT] ✅ (retry)', randomEmoticon, '|', mek.key.participant || 'unknown');
                } catch (retryErr) {
                    // Silent fail — status reactions are best-effort
                }
            }
        } catch (err) {
            // Silent fail — don't spam console with errors
        }
    });

    listenerInstalled = true;
    console.log('[AUTO-REACT] 🟢 Listener status activé');
}

function destroy() {
    listenerInstalled = false;
    sock = null;
}

module.exports = { init, destroy };
