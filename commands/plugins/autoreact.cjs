'use strict';

const { cmd } = require('../command.cjs');
const autoreact = require('../../lib/autoreact.cjs');

/**
 * ============================================================
 * DJOUSSE TECH — AUTO REACT STATUS (Command Wrapper)
 * ============================================================
 *
 * This file is a thin wrapper around lib/autoreact.cjs.
 * The actual listener logic lives in lib/autoreact.cjs.
 *
 * Commands:
 *   .autoreact / .statusreact / .ar
 *
 * ============================================================
 */

function initializeAutoReact(conn) {
    try {
        autoreact.init(conn, 'default', {
            enabled: true,
            delay: 1200,
            emojis: ['❤️','🔥','😍','😂','👏','💯','✨'],
            reactToOthers: true,
            reactToOwnStatus: true,
            preventDuplicates: true
        });
        return true;
    } catch (e) {
        console.error('[AUTO-REACT] Init error:', e.message);
        return false;
    }
}

cmd({
    pattern: 'autoreact',
    alias: ['statusreact', 'ar'],
    react: '❤️',
    desc: 'Activer et afficher AutoReact',
    category: 'tools',
    filename: __filename
}, async (conn, m, commands, { reply }) => {
    const st = autoreact.status();
    const status = st.enabled ? 'ACTIVÉ' : 'DÉSACTIVÉ';
    return reply(
        `┏━⍟「 ☣️ AUTO REACT ☣️ 」⍟━┓\n` +
        `┃\n` +
        `┃ 📌 Statut : ${status}\n` +
        `┃ ⏱️ Délai  : ${st.delay} ms\n` +
        `┃ 😊 Emojis : ${st.emojis.join(' ')}\n` +
        `┃ 🎯 Mode   : 1 réaction / statut\n` +
        `┃ 👤 Propre statut : ${st.reactToOwnStatus ? 'OUI' : 'NON'}\n` +
        `┃ 👀 Surveillance : ${st.listenerInstalled ? 'ACTIVE' : 'ERREUR'}\n` +
        `┃ 🔢 Cache : ${st.cacheSize} statuts\n` +
        `┃\n` +
        `┗━━━━━━━━━━━━━━━`
    );
});

module.exports = {
    autoReactStatus: autoreact.reactToStatus,
    initializeAutoReact,
    getEmojis: () => autoreact.config.emojis,
    getDelay: () => autoreact.config.delay,
    getRandomEmoji: () => {
        const emojis = autoreact.config.emojis;
        return emojis[Math.floor(Math.random() * emojis.length)] || '❤️';
    }
};
