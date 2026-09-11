'use strict';

const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');

const DEFAULT_EMOJIS = ['❤️', '🔥', '😍', '😂', '👏', '💯', '✨'];
const DEFAULT_DELAY = 1200;
const processedStatuses = new Map();

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getEmojis() {
    if (Array.isArray(config.AUTO_REACT_EMOJIS)) {
        const emojis = config.AUTO_REACT_EMOJIS.filter(e => typeof e === 'string').map(e => e.trim()).filter(Boolean);
        if (emojis.length) return emojis;
    }
    return DEFAULT_EMOJIS;
}

function getDelay() {
    const delay = Number(config.AUTO_REACT_DELAY);
    if (Number.isFinite(delay) && delay >= 300) return delay;
    return DEFAULT_DELAY;
}

function cleanupCache() {
    const now = Date.now();
    for (const [key, timestamp] of processedStatuses) {
        if (now - timestamp > 30 * 60 * 1000) processedStatuses.delete(key);
    }
}

async function autoReactStatus(conn, statusMessage) {
    if (!conn || !statusMessage?.key) return;

    const jid = statusMessage.key.remoteJid;
    if (jid !== 'status@broadcast') return;
    if (statusMessage.key.fromMe === true) return;

    const messageId = statusMessage.key.id;
    if (!messageId) return;

    if (processedStatuses.has(messageId)) return;
    processedStatuses.set(messageId, Date.now());
    cleanupCache();

    const emojis = getEmojis();
    const delay = getDelay();

    for (const emoji of emojis) {
        try {
            await conn.sendMessage('status@broadcast', {
                react: { text: emoji, key: statusMessage.key }
            });
            await sleep(delay);
        } catch (_) {}
    }
}

module.exports = { autoReactStatus, getEmojis, getDelay };

cmd({
    pattern: 'autoreact',
    alias: ['statusreact', 'ar'],
    react: '❤️',
    desc: 'Afficher la configuration AutoReact',
    category: 'tools',
    filename: __filename
}, async (conn, m, commands, { reply }) => {
    const emojis = getEmojis();
    const delay = getDelay();
    const status = config.AUTO_STATUS_REACT ? 'ACTIVÉ' : 'DÉSACTIVÉ';

    return reply(
        `┏━⍟「 ☣ AUTO REACT ☣ 」⍟━┓\n` +
        `┃\n` +
        `┃ 📌 Statut : ${status}\n` +
        `┃ ⏱️ Délai  : ${delay} ms\n` +
        `┃ 😊 Emojis : ${emojis.join(' ')}\n` +
        `┃\n` +
        `┗━━━━━━━━━━━━━━━━━━━━━━━⍟`
    );
});
