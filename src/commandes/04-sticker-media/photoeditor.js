'use strict';

const style = require('../../config/style');

module.exports = {
    commands: ['photoeditor'],
    description: 'List built-in photo editing commands',
    permission: 'public',
    group: true,
    private: true,

    run: async (sock, message, args, ctx) => ctx.reply(style.renderOutgoingText(
        '🖼️ *Photo Editor*\n\nUse these built-in commands:\n• `.sticker` — convert to sticker\n• `.toimg` — convert sticker to image\n• `.tojpeg` — convert to JPEG\n• `.togif` — convert to GIF\n• `.color` — color palette from image'
    )),
};
