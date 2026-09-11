'use strict';

const { cmd } = require('../../command.cjs');
const { getGroupState, saveGroupState } = require('../guardian.cjs');

const ALL_PROTECTIONS = ['antilink', 'antispam', 'antiflood', 'antibot', 'antitag'];

cmd({
    pattern: 'protect',
    desc: 'Protection combinée du groupe',
    category: 'group',
    filename: __filename
}, async (conn, m, commands, { q, reply, isGroup }) => {
    if (!isGroup) return reply('❌ Groupe uniquement.');

    const jid = m.chat;
    const gs = getGroupState(jid);
    const args = q?.trim().toLowerCase();

    // .protect status
    if (args === 'status' || !args) {
        const lines = ALL_PROTECTIONS.map(p => {
            const on = gs[p];
            return `┃ ${on ? '🟢' : '🔴'} ${p}`;
        });

        return reply(
            `┏━⍟「 ☣ PROTECT STATUS ☣ 」⍟━┓\n` +
            `┃\n` +
            lines.join('\n') + '\n' +
            `┃\n` +
            `┃ ⚠️ Warn limit : ${gs.warnLimit || 3}\n` +
            `┃\n` +
            `┃ 💡 .protect on — tout activer\n` +
            `┃ 💡 .protect off — tout désactiver\n` +
            `┃\n` +
            `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
        );
    }

    // .protect on / .protect off
    if (args === 'on' || args === 'off') {
        const enable = args === 'on';
        for (const p of ALL_PROTECTIONS) {
            gs[p] = enable;
        }
        saveGroupState(jid, gs);

        await m.react(enable ? '🛡️' : '⚠️');
        return reply(
            `┏━⍟「 ☣ PROTECT ☣ 」⍟━┓\n` +
            `┃\n` +
            `┃ ${enable ? '🟢 TOUT ACTIVÉ' : '🔴 TOUT DÉSACTIVÉ'}\n` +
            `┃\n` +
            ALL_PROTECTIONS.map(p => `┃ ${enable ? '🟢' : '🔴'} ${p}`).join('\n') + '\n' +
            `┃\n` +
            `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
        );
    }

    return reply('❌ Usage: `.protect on|off|status`');
});

module.exports = {};
