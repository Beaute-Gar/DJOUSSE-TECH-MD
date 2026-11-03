'use strict';

const style = require('../../config/style');

module.exports = {
    // @legacy-order {"sourceFile":"03-protection/group3.js","sourceOrder":104,"definitionIndex":0,"entryOrder":292}
    commands: ['left'],
    description: 'Extended group management commands',
    permission: 'admin',
    group: true,
    private: false,

    run: async (sock, message, args, ctx) => {
        const { jid, contextInfo } = ctx;
        if (!global.leftMembers) global.leftMembers = new Map();
        const leftMembers = (global.leftMembers.get(jid) || []).slice(-20);
        const text = leftMembers.length
            ? `📤 *Recently Left Members (${leftMembers.length})*\n\n${leftMembers.map((member, index) => `*${index + 1}.* +${member.split('@')[0]}`).join('\n')}`
            : '📤 *Left Members*\n\nNo one has left this group recently.';

        await sock.sendMessage(jid, {
            text: style.renderInfo(text.split('\n')),
            contextInfo,
        }, { quoted: message });
    },
};
