'use strict';

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const style = require('../../config/style');

module.exports = {
    commands: ['tovideo'],
    description: 'Additional converters and downloaders',
    permission: 'public',
    group: true,
    private: true,

    run: async (sock, message, args, { jid, contextInfo }) => {
        await sock.sendPresenceUpdate('composing', jid);
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const videoMsg = quoted?.videoMessage || message.message?.videoMessage;

        if (!videoMsg) {
            return sock.sendMessage(jid, {
                text: style.renderError([
                    'Reply to a video or GIF with .tovideo to convert/send as video.',
                ]),
                contextInfo,
            }, { quoted: message });
        }

        let buffer;
        try {
            const stream = await downloadContentFromMessage(videoMsg, 'video');
            buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        } catch {
            return sock.sendMessage(jid, {
                text: style.renderError(['Could not download video.']),
                contextInfo,
            }, { quoted: message });
        }

        await sock.sendMessage(jid, {
            video: buffer,
            mimetype: 'video/mp4',
            caption: style.renderOutgoingText('🎥 Video'),
            contextInfo,
        }, { quoted: message });
    },
};
