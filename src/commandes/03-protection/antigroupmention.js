'use strict';

const style = require('../../config/style');

module.exports = {
    // @legacy-order {"sourceFile":"03-protection/group3.js","sourceOrder":104,"definitionIndex":0,"entryOrder":284}
    commands: ['antigroupmention'],
    description: 'Extended group management commands',
    permission: 'admin',
    group: true,
    private: false,

    run: async (sock, message, args, ctx) => {
        const { jid, contextInfo } = ctx;
        if (!global.antiGcMention) global.antiGcMention = new Set();
        const enabled = (args[0] || 'on').toLowerCase() === 'on';
        if (enabled) global.antiGcMention.add(jid);
        else global.antiGcMention.delete(jid);

        const text = enabled ? '🔕 *Anti-Group Mention ON*' : '🔕 *Anti-Group Mention OFF*';
        await sock.sendMessage(jid, {
            text: style.renderInfo(text.split('\n')),
            contextInfo,
        }, { quoted: message });
    },
};
