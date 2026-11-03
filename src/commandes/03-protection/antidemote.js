'use strict';

const style = require('../../config/style');

const enabledGroups = new Set();
global.antiDemoteGroups = enabledGroups;

module.exports = {
    // @legacy-order {"sourceFile":"03-protection/antidemote.js","sourceOrder":19,"definitionIndex":0,"entryOrder":74}
    commands: ['antidemote'],
    description: 'Kick anyone who demotes a group admin (requires bot to be admin)',
    permission: 'admin',
    group: true,
    private: false,

    run: async (sock, message, args, ctx) => {
        const { jid, safeSend, contextInfo, isBotAdmin, theme } = ctx;
        const action = (args[0] || '').toLowerCase();
        const send = (text, renderer = style.renderInfo) => safeSend({
            text: renderer(text.split('\n')),
            contextInfo,
        }, { quoted: message });

        if (!isBotAdmin) {
            await send(theme.botAdmin || '⚠️ *Anti-Demote* requires the bot to be a group admin first.', style.renderError);
            return;
        }

        if (action === 'on') {
            enabledGroups.add(jid);
            await send('🛡️ *Anti-Demote is ON*\n\nAnyone who demotes a group admin will be removed from the group.');
        } else if (action === 'off') {
            enabledGroups.delete(jid);
            await send('🛡️ *Anti-Demote is OFF*');
        } else {
            const status = enabledGroups.has(jid) ? '✅ ON' : '❌ OFF';
            await send(`🛡️ *Anti-Demote*\nStatus: ${status}\n\n*Usage:*\n• \`.antidemote on\` — enable\n• \`.antidemote off\` — disable`);
        }
    },
};
