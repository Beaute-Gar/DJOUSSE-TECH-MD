'use strict';

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const style = require('../../config/style');

module.exports = {
    commands: ['stickertoimg', 'unwebp'],
    description: 'Convert sticker to JPEG image',
    permission: 'public',
    group: true,
    private: true,

    run: async (sock, message, args, { sender, contextInfo }) => {
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const stickerMsg = quoted?.stickerMessage || message.message?.stickerMessage;

        if (!stickerMsg) {
            return sock.sendMessage(sender, {
                text: style.renderInfo(['Reply to a sticker with .tojpeg to convert it.']),
                contextInfo,
            }, { quoted: message });
        }

        try {
            const stream = await downloadContentFromMessage(stickerMsg, 'sticker');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            await sock.sendMessage(sender, {
                image: buffer,
                mimetype: 'image/webp',
                caption: style.renderOutgoingText('🖼️ *Sticker converted to image*\n_Powered by DJOUSSE TECH_'),
                contextInfo,
            }, { quoted: message });
        } catch (error) {
            await sock.sendMessage(sender, {
                text: style.renderError([`Conversion failed: ${error.message}`]),
                contextInfo,
            }, { quoted: message });
        }
    },
};
