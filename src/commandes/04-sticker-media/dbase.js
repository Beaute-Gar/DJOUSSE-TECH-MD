'use strict';

const style = require('../../config/style');

module.exports = {
    commands: ['dbase'],
    description: 'Decode Base64 text',
    permission: 'public',
    group: true,
    private: true,

    run: async (sock, message, args, ctx) => {
        const text = args.join(' ').trim();
        const reply = value => ctx.reply(style.renderOutgoingText(value));

        if (!text) return reply('❌ *Usage:* `.dbase <base64>`');
        try {
            return reply(`🔐 *Base64 Decode*\n\n*Input:* ${text}\n*Output:* ${Buffer.from(text, 'base64').toString('utf8')}`);
        } catch {
            return reply('❌ Invalid base64 input.');
        }
    },
};
