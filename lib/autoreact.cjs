'use strict';

/**
 * AUTO-REACT STATUS
 * Exact copy of https://github.com/iluser/autoreact-whatsapp
 * Adapted to work as a module within DJOUSSE TECH MD bot
 */

const emoticons = ['😺', '🔥', '❤️\u200D🔥', '❤️\u200D🩹', '💛', '🙀', '🫠', '👀', '💕', '💖', '💘', '💞', '💓', '💗'];

let sock = null;
let listenerInstalled = false;

function init(whatsappSocket) {
    if (!whatsappSocket) throw new Error('autoreact.init(): socket WhatsApp obligatoire');
    sock = whatsappSocket;

    if (listenerInstalled) {
        console.log('[AUTO-REACT] Listener déjà installé');
        return;
    }

    if (!sock.ev || typeof sock.ev.on !== 'function') {
        throw new Error('Événement Baileys indisponible');
    }

    // EXACT copy from reference repo handler
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            let mek = chatUpdate.messages[0];
            if (!mek.message) return;
            mek.message = Object.keys(mek.message)[0] === 'ephemeralMessage'
                ? mek.message.ephemeralMessage.message
                : mek.message;

            if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                await sock.readMessages([mek.key]);
                try {
                    const randomEmoticon = emoticons[Math.floor(Math.random() * emoticons.length)];
                    if (mek.key.remoteJid === 'status@broadcast') {
                        await sock.sendMessage(
                            mek.key.remoteJid,
                            { react: { key: mek.key, text: randomEmoticon } },
                            { statusJidList: [mek.key.participant, sock.user.id] }
                        );
                        console.log('[AUTO-REACT] ✅ Réaction envoyée:', randomEmoticon, '| participant:', mek.key.participant || 'unknown');
                    }
                } catch (error) {
                    console.error('[AUTO-REACT] ❌ Erreur réaction:', error.message);
                    return;
                }
            }
        } catch (err) {
            console.log('[AUTO-REACT] Erreur:', err);
        }
    });

    listenerInstalled = true;
    console.log('[AUTO-REACT] 🟢 Listener activé (code exact iluser/autoreact-whatsapp)');
    console.log('[AUTO-REACT] Emojis:', emoticons.join(' '));
}

function destroy() {
    listenerInstalled = false;
    sock = null;
}

module.exports = { init, destroy };
