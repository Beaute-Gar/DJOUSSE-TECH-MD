'use strict';

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const style = require('../../config/style');

module.exports = {
    commands: ['toptt'],
    description: 'Additional converters and downloaders',
    permission: 'public',
    group: true,
    private: true,

    run: async (sock, message, args, { jid, contextInfo }) => {
        await sock.sendPresenceUpdate('composing', jid);
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const audioMsg = quoted?.audioMessage || message.message?.audioMessage;

        if (!audioMsg) {
            return sock.sendMessage(jid, {
                text: style.renderInfo([
                    'Reply to an audio or voice message with .toptt',
                    'Sends any audio as a voice note (PTT).',
                ]),
                contextInfo,
            }, { quoted: message });
        }

        let buffer;
        try {
            const stream = await downloadContentFromMessage(audioMsg, 'audio');
            buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        } catch {
            return sock.sendMessage(jid, {
                text: style.renderError(['Could not download audio.']),
                contextInfo,
            }, { quoted: message });
        }

        await sock.sendMessage(jid, {
            audio: buffer,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true,
            contextInfo,
        }, { quoted: message });
    },
};
