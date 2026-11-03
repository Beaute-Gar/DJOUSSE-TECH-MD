'use strict';

const style = require('../../config/style');

module.exports = {
    commands: ['ebase'],
    description: 'Encode text as Base64',
    permission: 'public',
    group: true,
    private: true,

    run: async (sock, message, args, ctx) => {
        const text = args.join(' ').trim();
        const reply = value => ctx.reply(style.renderOutgoingText(value));

        if (!text) return reply('❌ *Usage:* `.ebase <text>`');
        return reply(`🔐 *Base64 Encode*\n\n*Input:* ${text}\n*Output:* ${Buffer.from(text).toString('base64')}`);
    },
};
