'use strict';

const style = require('../../config/style');

module.exports = {
    // @legacy-order {"sourceFile":"03-protection/group3.js","sourceOrder":104,"definitionIndex":0,"entryOrder":287}
    commands: ['setantigcmentionwarnlimit'],
    description: 'Extended group management commands',
    permission: 'admin',
    group: true,
    private: false,

    run: async (sock, message, args, ctx) => {
        const { jid, contextInfo } = ctx;
        const limit = parseInt(args[0]);
        const send = (text, renderer = style.renderInfo) => sock.sendMessage(jid, {
            text: renderer(text.split('\n')),
            contextInfo,
        }, { quoted: message });

        if (!limit || limit < 1) {
            return send('❌ *Usage:* `.setantigcmentionwarnlimit <number>`\n\nExample: `.setantigcmentionwarnlimit 3`', style.renderError);
        }
        if (!global.antiGcMentionLimits) global.antiGcMentionLimits = new Map();
        global.antiGcMentionLimits.set(jid, limit);
        return send(`✅ Anti-group-mention warn limit set to *${limit}* warnings.`);
    },
};
