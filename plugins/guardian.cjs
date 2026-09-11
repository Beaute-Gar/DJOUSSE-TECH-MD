'use strict';

const { cmd } = require('../command.cjs');
const fs = require('fs');
const path = require('path');

// ─── State file ──────────────────────────────────────────────────
const STATE_FILE = path.join(__dirname, '..', 'data', 'guardian.json');

function loadState() {
    try {
        fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    } catch { return {}; }
}

function saveState(data) {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
}

function getGroupState(jid) {
    const state = loadState();
    if (!state[jid]) {
        state[jid] = {
            antilink: false, antispam: false, antiflood: false,
            antibot: false, antitag: false, warnLimit: 3,
            warns: {}, floodTracker: {}, spamTracker: {}
        };
        saveState(state);
    }
    return state[jid];
}

function saveGroupState(jid, gs) {
    const state = loadState();
    state[jid] = gs;
    saveState(state);
}

// ─── Protection handlers ─────────────────────────────────────────

async function handleGuardian(conn, msg, jid, num) {
    const gs = getGroupState(jid);
    const sender = msg.key?.participant || msg.key?.remoteJid;
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

    // ANTI-LINK
    if (gs.antilink) {
        const linkRegex = /(?:https?:\/\/)?(?:www\.)?(?:chat\.whatsapp\.com|whatsapp\.com\/channel|t\.me|instagram\.com|tiktok\.com|facebook\.com|x\.com|twitter\.com)/i;
        if (linkRegex.test(text)) {
            const ownerNumber = require('../config-djousse.cjs').OWNER_NUMBER;
            if (sender && !sender.startsWith(ownerNumber)) {
                await warnUser(jid, sender, gs, 'Lien non autorisé', conn, msg);
                return true;
            }
        }
    }

    // ANTI-SPAM (messages identiques < 5s)
    if (gs.antispam) {
        if (!gs.spamTracker) gs.spamTracker = {};
        const key = sender || '';
        const now = Date.now();
        if (gs.spamTracker[key] && gs.spamTracker[key].text === text && now - gs.spamTracker[key].time < 5000) {
            await warnUser(jid, sender, gs, 'Spam détecté', conn, msg);
            return true;
        }
        gs.spamTracker[key] = { text, time: now };
        saveGroupState(jid, gs);
    }

    // ANTI-FLOOD (> 5 messages en 10s)
    if (gs.antiflood) {
        if (!gs.floodTracker) gs.floodTracker = {};
        const key = sender || '';
        const now = Date.now();
        if (!gs.floodTracker[key]) gs.floodTracker[key] = [];
        gs.floodTracker[key] = gs.floodTracker[key].filter(t => now - t < 10000);
        gs.floodTracker[key].push(now);
        if (gs.floodTracker[key].length > 5) {
            await warnUser(jid, sender, gs, 'Flood détecté', conn, msg);
            gs.floodTracker[key] = [];
            saveGroupState(jid, gs);
            return true;
        }
        saveGroupState(jid, gs);
    }

    // ANTI-BOT (messages from bot-like JIDs)
    if (gs.antibot) {
        if (sender && (sender.endsWith('@g.us') || sender.includes('bot'))) {
            await conn.sendMessage(jid, { delete: msg.key });
            return true;
        }
    }

    return false;
}

async function warnUser(jid, sender, gs, reason, conn, msg) {
    if (!sender) return;
    const clean = sender.replace(/[^0-9]/g, '');
    if (!gs.warns) gs.warns = {};
    gs.warns[clean] = (gs.warns[clean] || 0) + 1;
    saveGroupState(jid, gs);

    const count = gs.warns[clean];
    const limit = gs.warnLimit || 3;

    // Supprimer le message
    try { await conn.sendMessage(jid, { delete: msg.key }); } catch (_) {}

    if (count >= limit) {
        // Kick
        try {
            await conn.groupParticipantsUpdate(jid, [sender], 'remove');
            delete gs.warns[clean];
            saveGroupState(jid, gs);
            await conn.sendMessage(jid, { text: `🚫 @${clean} expulsé (${reason}, ${count}/${limit} warnings)`, mentions: [sender] });
        } catch (_) {}
    } else {
        await conn.sendMessage(jid, {
            text: `⚠️ @${clean} — ${reason}\n📊 Warning ${count}/${limit}`,
            mentions: [sender]
        });
    }
}

// ─── Commands ────────────────────────────────────────────────────

cmd({
    pattern: 'guardian',
    alias: ['guard', 'protector'],
    desc: 'Centre de contrôle Guardian',
    category: 'group',
    filename: __filename
}, async (conn, m, commands, { q, reply, isGroup, groupMetadata }) => {
    if (!isGroup) return reply('❌ Cette commande est pour les groupes.');

    const jid = m.chat;
    const gs = getGroupState(jid);

    const status = (flag, label) => `${flag ? '🟢' : '🔴'} ${label}`;

    return reply(
        `┏━⍟「 ☣ GUARDIAN ☣ 」⍟━┓\n` +
        `┃\n` +
        `┃ 🛡️ Protection du groupe\n` +
        `┃\n` +
        `┃ ${status(gs.antilink, 'Anti-Link')}\n` +
        `┃ ${status(gs.antispam, 'Anti-Spam')}\n` +
        `┃ ${status(gs.antiflood, 'Anti-Flood')}\n` +
        `┃ ${status(gs.antibot, 'Anti-Bot')}\n` +
        `┃ ${status(gs.antitag, 'Anti-Tag')}\n` +
        `┃\n` +
        `┃ ⚠️ Warn limit : ${gs.warnLimit || 3}\n` +
        `┃\n` +
        `┃ 💡 .guardian <on/off> <protection>\n` +
        `┃ Ex: .guardian on antilink\n` +
        `┃\n` +
        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
    );
});

cmd({
    pattern: 'guardian (on|off) (.+)',
    desc: 'Activer/Désactiver une protection',
    category: 'group',
    filename: __filename,
    fromMe: true
}, async (conn, m, commands, { q, reply, isGroup }) => {
    if (!isGroup) return reply('❌ Groupe uniquement.');

    const match = q.match(/guardian\s+(on|off)\s+(.+)/i);
    if (!match) return reply('❌ Format: `.guardian on|off <protection>`');

    const enable = match[1].toLowerCase() === 'on';
    const protection = match[2].toLowerCase().trim();
    const valid = ['antilink', 'antispam', 'antiflood', 'antibot', 'antitag'];

    if (!valid.includes(protection)) {
        return reply(`❌ Protections: ${valid.join(', ')}`);
    }

    const jid = m.chat;
    const gs = getGroupState(jid);
    gs[protection] = enable;
    saveGroupState(jid, gs);

    await m.react(enable ? '🛡️' : '⚠️');
    return reply(
        `┏━⍟「 ☣ GUARDIAN ☣ 」⍟━┓\n` +
        `┃\n` +
        `┃ ${protection.toUpperCase()} : ${enable ? '🟢 ACTIVÉ' : '🔴 DÉSACTIVÉ'}\n` +
        `┃\n` +
        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
    );
});

cmd({
    pattern: 'warnlimit (.+)',
    desc: 'Définir la limite de warnings',
    category: 'group',
    filename: __filename,
    fromMe: true
}, async (conn, m, commands, { q, reply, isGroup }) => {
    if (!isGroup) return reply('❌ Groupe uniquement.');

    const limit = parseInt(q.replace('warnlimit', '').trim());
    if (isNaN(limit) || limit < 1 || limit > 10) return reply('❌ Limite entre 1 et 10');

    const gs = getGroupState(m.chat);
    gs.warnLimit = limit;
    saveGroupState(m.chat, gs);

    return reply(`⚠️ Warn limit définie à ${limit}`);
});

cmd({
    pattern: 'warnings',
    alias: ['warns'],
    desc: 'Voir les warnings du groupe',
    category: 'group',
    filename: __filename
}, async (conn, m, commands, { reply, isGroup }) => {
    if (!isGroup) return reply('❌ Groupe uniquement.');

    const gs = getGroupState(m.chat);
    const warns = gs.warns || {};
    const entries = Object.entries(warns).filter(([, v]) => v > 0);

    if (entries.length === 0) return reply('✅ Aucun warning dans ce groupe.');

    const list = entries.map(([num, count]) => `┃ ⚠️ @${num} — ${count}/${gs.warnLimit || 3}`).join('\n');
    const mentions = entries.map(([num]) => num + '@s.whatsapp.net');

    return reply(
        `┏━⍟「 ☣ WARNINGS ☣ 」⍟━┓\n` +
        `┃\n` +
        list + '\n' +
        `┃\n` +
        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
    );
});

module.exports = { handleGuardian };
