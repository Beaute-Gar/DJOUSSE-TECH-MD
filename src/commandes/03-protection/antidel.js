'use strict';

const config = require('../_partage/config');
const style = require('../../config/style');

module.exports = {
    // @legacy-order {"sourceFile":"03-protection/antidelete.js","sourceOrder":18,"definitionIndex":0,"entryOrder":73}
    commands: ['antidel'],
    description: 'Toggle anti-delete — recovers deleted and edited messages and forwards them to you',
    permission: 'owner',
    group: true,
    private: true,

    run: async (sock, message, args, ctx) => {
        const { safeSend, contextInfo } = ctx;
        const action = (args[0] || '').toLowerCase();
        const send = (text) => safeSend({
            text: style.renderInfo(text.split('\n')),
            contextInfo,
        }, { quoted: message });

        if (action === 'on') {
            config.ANTIDELETE_GROUP = true;
            config.ANTIDELETE_PRIVATE = true;
            await send('🛡️ *Anti-Delete is ON*\n\nDeleted and edited messages will be recovered and forwarded to you in both groups and private chats.');
        } else if (action === 'off') {
            config.ANTIDELETE_GROUP = false;
            config.ANTIDELETE_PRIVATE = false;
            await send('🛡️ *Anti-Delete is OFF*');
        } else {
            const groupStatus = config.ANTIDELETE_GROUP ? '✅ ON' : '❌ OFF';
            const privateStatus = config.ANTIDELETE_PRIVATE ? '✅ ON' : '❌ OFF';
            await send(`🛡️ *Anti-Delete Status*\n\n📌 Groups: ${groupStatus}\n📌 Private: ${privateStatus}\n\n*Usage:*\n• \`.antidelete on\` — enable\n• \`.antidelete off\` — disable`);
        }
    },
};
