'use strict';

const style = require('../../config/style');

module.exports = {
    // @legacy-order {"sourceFile":"03-protection/group3.js","sourceOrder":104,"definitionIndex":0,"entryOrder":293}
    commands: ['antibadwarn'],
    description: 'Extended group management commands',
    permission: 'admin',
    group: true,
    private: false,

    run: async (sock, message, args, ctx) => {
        const { jid, contextInfo } = ctx;
        const text = '⚠️ *Anti-Bad Word Warn*\n\nMembers who use bad words are automatically warned.\n\nManage words with `.setantibad <words>` and `.badwords`';
        await sock.sendMessage(jid, {
            text: style.renderInfo(text.split('\n')),
            contextInfo,
        }, { quoted: message });
    },
};
