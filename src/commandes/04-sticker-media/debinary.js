'use strict';

const style = require('../../config/style');

module.exports = {
    commands: ['debinary'],
    description: 'Convert binary to text',
    permission: 'public',
    group: true,
    private: true,

    run: async (sock, message, args, ctx) => {
        const text = args.join(' ').trim();
        const reply = value => ctx.reply(style.renderOutgoingText(value));

        if (!text) return reply('❌ *Usage:* `.debinary <binary>`');

        try {
            const decoded = text.trim().split(/\s+/)
                .map(binary => String.fromCharCode(parseInt(binary, 2)))
                .join('');
            return reply(`🔢 *Binary → Text*\n\n*Input:* ${text}\n*Output:* ${decoded}`);
        } catch {
            return reply('❌ Invalid binary input.');
        }
    },
};
