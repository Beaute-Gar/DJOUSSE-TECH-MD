'use strict';

const config = require('../_partage/config');
const style = require('../../config/style');

module.exports = {
    // @legacy-order {"sourceFile":"03-protection/autojoin.js","sourceOrder":30,"definitionIndex":0,"entryOrder":85}
    commands: ['autojoin'],
    description: 'Manually trigger group auto-join (owner only)',
    permission: 'owner',
    group: false,
    private: true,

    run: async (sock, message, args, ctx) => {
        const { sender, contextInfo } = ctx;
        const codes = (config.AUTO_JOIN_GROUPS || '').split(',').map((code) => code.trim()).filter(Boolean);
        const send = (text, renderer = style.renderInfo) => sock.sendMessage(sender, {
            text: renderer(text.split('\n')),
            contextInfo,
        }, { quoted: message });

        if (!codes.length) {
            return send('⚠️ No AUTO_JOIN_GROUPS configured.', style.renderError);
        }

        let joined = 0;
        let skipped = 0;
        let failed = 0;
        for (const code of codes) {
            try {
                await sock.groupAcceptInvite(code);
                joined++;
            } catch (error) {
                const messageText = error.message || '';
                if (/already/i.test(messageText) || /409/.test(messageText)) {
                    skipped++;
                } else {
                    failed++;
                    console.error(`[AutoJoin] ${code}: ${messageText}`);
                }
            }
        }

        await send(`✅ *Auto-join complete*\n• Joined: ${joined}\n• Already in: ${skipped}\n• Failed: ${failed}`);
    },
};
