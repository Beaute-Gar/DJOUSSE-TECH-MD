'use strict';

const { cmd } = require('../../command.cjs');
const { getGroupState, saveGroupState } = require('../guardian.cjs');

cmd({
    pattern: 'groupsecure',
    alias: ['gsecure', 'secgroup'],
    desc: 'Configuration complète sécurité du groupe',
    category: 'group',
    filename: __filename
}, async (conn, m, commands, { q, reply, isGroup }) => {
    if (!isGroup) return reply('❌ Groupe uniquement.');

    const jid = m.chat;
    const gs = getGroupState(jid);
    const args = q?.trim().toLowerCase();

    // .groupsecure — setup complet
    if (!args || args === 'setup') {
        // Activer toutes les protections
        for (const p of ['antilink', 'antispam', 'antiflood', 'antibot', 'antitag']) {
            gs[p] = true;
        }
        gs.warnLimit = 3;
        saveGroupState(jid, gs);

        await m.react('🛡️');
        return reply(
            `┏━⍟「 ☣ GROUP SECURE — ACTIVÉ ☣ 」⍟━┓\n` +
            `┃\n` +
            `┃ 🛡️ Configuration complète appliquée\n` +
            `┃\n` +
            `┃ 🟢 Anti-Link      — activé\n` +
            `┃ 🟢 Anti-Spam      — activé\n` +
            `┃ 🟢 Anti-Flood     — activé\n` +
            `┃ 🟢 Anti-Bot       — activé\n` +
            `┃ 🟢 Anti-Tag       — activé\n` +
            `┃ 🟢 Warning System — 3 max\n` +
            `┃ 🟢 Guardian       — actif\n` +
            `┃ 🟢 Anti-Scam      — actif\n` +
            `┃\n` +
            `┃ 💡 .groupsecure off — désactiver tout\n` +
            `┃ 💡 .groupsecure status — état actuel\n` +
            `┃\n` +
            `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
        );
    }

    // .groupsecure off
    if (args === 'off') {
        for (const p of ['antilink', 'antispam', 'antiflood', 'antibot', 'antitag']) {
            gs[p] = false;
        }
        saveGroupState(jid, gs);

        return reply(
            `┏━⍟「 ☣ GROUP SECURE — DÉSACTIVÉ ☣ 」⍟━┓\n` +
            `┃\n` +
            `┃ 🔴 Toutes les protections désactivées\n` +
            `┃\n` +
            `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
        );
    }

    // .groupsecure status
    if (args === 'status') {
        const allOn = ['antilink', 'antispam', 'antiflood', 'antibot', 'antitag'].every(p => gs[p]);
        return reply(
            `┏━⍟「 ☣ GROUP SECURE STATUS ☣ 」⍟━┓\n` +
            `┃\n` +
            `┃ ${allOn ? '🟢 SÉCURISÉ' : '🟡 PARTIELLEMENT SÉCURISÉ'}\n` +
            `┃\n` +
            ['antilink', 'antispam', 'antiflood', 'antibot', 'antitag'].map(p =>
                `┃ ${gs[p] ? '🟢' : '🔴'} ${p}`
            ).join('\n') + '\n' +
            `┃\n` +
            `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
        );
    }

    return reply('❌ Usage: `.groupsecure` | `.groupsecure off` | `.groupsecure status`');
});

module.exports = {};
