'use strict';

const style = require('../../config/style');

module.exports = {
    // @legacy-order {"sourceFile":"03-protection/group3.js","sourceOrder":104,"definitionIndex":0,"entryOrder":282}
    commands: ['setantilink'],
    description: 'Extended group management commands',
    permission: 'admin',
    group: true,
    private: false,

    run: async (sock, message, args, ctx) => {
        const { jid, contextInfo } = ctx;
        if (!global.antilinkGroups) global.antilinkGroups = new Set();
        const sub = (args[0] || 'on').toLowerCase();
        const enabled = sub === 'on' || sub === 'enable';
        if (enabled) global.antilinkGroups.add(jid);
        else global.antilinkGroups.delete(jid);

        const text = enabled
            ? '🔗 *Anti-Link ON* — Links will be deleted and sender warned.'
            : '🔗 *Anti-Link OFF*';
        await sock.sendMessage(jid, {
            text: style.renderInfo(text.split('\n')),
            contextInfo,
        }, { quoted: message });
    },
};
