'use strict';

const style = require('../../config/style');

module.exports = {
    commands: ['ebinary'],
    description: 'Convert text to binary',
    permission: 'public',
    group: true,
    private: true,

    run: async (sock, message, args, ctx) => {
        const text = args.join(' ').trim();
        const reply = value => ctx.reply(style.renderOutgoingText(value));

        if (!text) return reply('❌ *Usage:* `.ebinary <text>`');

        const binary = text.split('')
            .map(character => character.charCodeAt(0).toString(2).padStart(8, '0'))
            .join(' ');
        return reply(`🔢 *Text → Binary*\n\n*Input:* ${text}\n*Output:* ${binary}`);
    },
};
