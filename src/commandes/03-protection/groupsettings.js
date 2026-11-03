'use strict';

const style = require('../../config/style');

module.exports = {
    // @legacy-order {"sourceFile":"03-protection/group3.js","sourceOrder":104,"definitionIndex":0,"entryOrder":277}
    commands: ['groupsettings'],
    description: 'Extended group management commands',
    permission: 'admin',
    group: true,
    private: false,

    run: async (sock, message, args, ctx) => {
        const { jid, contextInfo, groupMetadata } = ctx;
        const participants = groupMetadata?.participants || [];
        const admins = participants.filter((participant) => participant.admin).length;
        const ephemeralDuration = groupMetadata?.ephemeralDuration;
        const label = ephemeralDuration
            ? ephemeralDuration === 86400
                ? '24h'
                : ephemeralDuration === 604800
                    ? '7 days'
                    : '90 days'
            : 'OFF';
        const text =
            `⚙️ *Group Settings*\n\n` +
            `👥 Members: *${participants.length}*\n` +
            `👑 Admins: *${admins}*\n` +
            `🔒 Locked: *${groupMetadata?.announce ? 'Yes' : 'No'}*\n` +
            `⏳ Disappear: *${label}*\n` +
            `📝 Description: ${groupMetadata?.desc ? groupMetadata.desc.slice(0, 80) : 'None'}`;

        await sock.sendMessage(jid, {
            text: style.renderInfo(text.split('\n')),
            contextInfo,
        }, { quoted: message });
    },
};
