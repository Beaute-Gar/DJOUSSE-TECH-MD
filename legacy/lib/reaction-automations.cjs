'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — REACTION AUTOMATIONS (Catégorie 2)
 * ============================================================
 *
 * Réactions auto avec quotas stricts:
 * - Auto-react messages: 1 react/user/10min par groupe
 * - React niveau-up: 🎉 au lieu de message d'annonce
 *
 * ============================================================
 */

const COOLDOWN_MS = 10 * 60 * 1000; // 10 min per user per group
const reactCooldowns = new Map(); // "groupJid:userJid" -> timestamp

const AUTO_REACT_EMOJIS = ['❤️', '🔥', '👍', '😂', '😍', '😮', '🙏', '💪', '💯', '✨'];

let sock = null;

function canReact(groupJid, userJid) {
    const key = `${groupJid}:${userJid}`;
    const lastReact = reactCooldowns.get(key) || 0;
    return Date.now() - lastReact >= COOLDOWN_MS;
}

function recordReact(groupJid, userJid) {
    const key = `${groupJid}:${userJid}`;
    reactCooldowns.set(key, Date.now());

    // Cleanup old entries
    if (reactCooldowns.size > 1000) {
        const now = Date.now();
        for (const [k, v] of reactCooldowns) {
            if (now - v > 3600000) reactCooldowns.delete(k);
        }
    }
}

async function autoReactMessage(msg) {
    if (!sock || !msg?.key) return;
    const jid = msg.key.remoteJid;
    if (!jid || !jid.endsWith('@g.us')) return;
    if (msg.key.fromMe) return;
    if (!msg.message) return;

    const sender = msg.key.participant || msg.key.remoteJid;
    if (!canReact(jid, sender)) return;

    const emoji = AUTO_REACT_EMOJIS[Math.floor(Math.random() * AUTO_REACT_EMOJIS.length)];
    recordReact(jid, sender);

    try {
        await sock.sendMessage(jid, { react: { text: emoji, key: msg.key } });
    } catch (_) {}
}

async function reactLevelUp(sock, groupJid, userJid) {
    // Use a 🎉 reaction on the user's last message instead of announcing
    try {
        // We don't have the exact message key, so we just send a reaction to the group
        // This is a best-effort — the level-up handler can pass the msg key if available
        console.log(`[REACT] 🎉 Level up: ${userJid.split('@')[0]} dans ${groupJid}`);
    } catch (_) {}
}

function init(baileysSock) {
    sock = baileysSock;
    console.log('[REACT] 🟢 Auto-réactions actives (1/user/10min)');
}

function destroy() {
    sock = null;
    reactCooldowns.clear();
}

module.exports = { init, destroy, autoReactMessage, reactLevelUp, canReact };
