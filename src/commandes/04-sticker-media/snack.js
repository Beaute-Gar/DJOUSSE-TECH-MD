'use strict';

const style = require('../../config/style');

module.exports = {
    commands: ['snack'],
    description: 'Additional converters and downloaders',
    permission: 'public',
    group: true,
    private: true,

    run: async (sock, message, args, ctx) => {
        const text = args.join(' ').trim();
        const reply = value => ctx.reply(style.renderOutgoingText(value));

        if (!text) return reply('❌ *Usage:* `.snack <snackvideo url>`');
        return reply('⚠️ Snack Video downloader is unavailable. Try SnapTik.app or SaveFrom.net instead.');
    },
};
