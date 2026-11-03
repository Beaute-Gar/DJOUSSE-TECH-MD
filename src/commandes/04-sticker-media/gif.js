'use strict';

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const style = require('../../config/style');

module.exports = {
    commands: ['gif', 'mp4togif'],
    description: 'Convert sticker or video to GIF',
    permission: 'public',
    group: true,
    private: true,

    run: async (sock, message, args, { sender, contextInfo }) => {
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const stickerMsg = quoted?.stickerMessage || message.message?.stickerMessage;
        const videoMsg = quoted?.videoMessage || message.message?.videoMessage;
        const target = stickerMsg || videoMsg;
        const typeHint = stickerMsg ? 'sticker' : 'video';

        if (!target) {
            return sock.sendMessage(sender, {
                text: style.renderInfo(['Reply to a sticker or video with .togif to convert it to GIF.']),
                contextInfo,
            }, { quoted: message });
        }

        await sock.sendMessage(sender, {
            text: style.renderInfo(['Converting to GIF...']),
            contextInfo,
        }, { quoted: message });

        try {
            const stream = await downloadContentFromMessage(target, typeHint);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            await sock.sendMessage(sender, {
                video: buffer,
                gifPlayback: true,
                mimetype: 'video/mp4',
                contextInfo,
            }, { quoted: message });
        } catch (error) {
            await sock.sendMessage(sender, {
                text: style.renderError([`GIF conversion failed: ${error.message}`]),
                contextInfo,
            }, { quoted: message });
        }
    },
};
