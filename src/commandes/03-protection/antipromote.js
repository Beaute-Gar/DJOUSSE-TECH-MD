'use strict';

const style = require('../../config/style');

module.exports = {
    // @legacy-order {"sourceFile":"03-protection/group3.js","sourceOrder":104,"definitionIndex":0,"entryOrder":285}
    commands: ['antipromote'],
    description: 'Extended group management commands',
    permission: 'admin',
    group: true,
    private: false,

    run: async (sock, message, args, ctx) => {
        const { jid, contextInfo } = ctx;
        if (!global.antiPromote) global.antiPromote = new Set();
        const enabled = (args[0] || 'on').toLowerCase() === 'on';
        if (enabled) global.antiPromote.add(jid);
        else global.antiPromote.delete(jid);

        const text = enabled
            ? '⬆️ *Anti-Promote ON* — Non-admin promotions will be reversed.'
            : '⬆️ *Anti-Promote OFF*';
        await sock.sendMessage(jid, {
            text: style.renderInfo(text.split('\n')),
            contextInfo,
        }, { quoted: message });
    },
};
