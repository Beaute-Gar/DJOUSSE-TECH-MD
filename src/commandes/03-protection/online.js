'use strict';

const style = require('../../config/style');

module.exports = {
    // @legacy-order {"sourceFile":"03-protection/group3.js","sourceOrder":104,"definitionIndex":0,"entryOrder":280}
    commands: ['online'],
    description: 'Extended group management commands',
    permission: 'admin',
    group: true,
    private: false,

    run: async (sock, message, args, ctx) => {
        const { jid, contextInfo, groupMetadata } = ctx;
        const participants = groupMetadata?.participants || [];
        const text = `👥 *Group Members (${participants.length})*\n\n${participants.map((participant, index) => `*${index + 1}.* @${participant.id.split('@')[0]}`).join('\n')}`;

        await sock.sendMessage(jid, {
            text: style.renderInfo(text.split('\n')),
            mentions: participants.map((participant) => participant.id),
            contextInfo,
        }, { quoted: message });
    },
};
