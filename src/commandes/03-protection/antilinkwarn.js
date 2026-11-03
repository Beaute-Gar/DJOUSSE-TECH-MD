'use strict';

const style = require('../../config/style');

module.exports = {
    // @legacy-order {"sourceFile":"03-protection/group3.js","sourceOrder":104,"definitionIndex":0,"entryOrder":294}
    commands: ['antilinkwarn'],
    description: 'Extended group management commands',
    permission: 'admin',
    group: true,
    private: false,

    run: async (sock, message, args, ctx) => {
        const { jid, contextInfo } = ctx;
        const text = '⚠️ *Anti-Link Warn*\n\nMembers who post links get warned.\n\nToggle with `.setantilink on/off`';
        await sock.sendMessage(jid, {
            text: style.renderInfo(text.split('\n')),
            contextInfo,
        }, { quoted: message });
    },
};
