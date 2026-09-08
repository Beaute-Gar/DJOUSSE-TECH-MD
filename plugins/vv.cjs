const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function downloadMedia(msgContent, type) {
    const stream = await downloadContentFromMessage(msgContent, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
}

cmd({
    pattern: 'vv',
    alias: ['sendme', 'viewonce', 'vu', 'once'],
    react: '👻',
    desc: 'Forward quoted view-once message to your DM',
    category: 'tools',
    filename: __filename
}, async (conn, m, commands, { from, reply, isOwner }) => {
    try {
        const quoted = m.quoted;
        if (!quoted) {
            return reply(box('VV', [
                '❌ Reply to a view-once message with .vv',
                '',
                '📌 Usage: .vv (reply to view-once)'
            ]));
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

        let mediaData;
        try {
            mediaData = await quoted.download();
        } catch (err) {
            return reply('❌ Download failed: ' + err.message);
        }

        const messageType = quoted.mtype || 'textMessage';
        const senderJid = m.sender;

        let forwardData = {};

        switch (messageType) {
            case 'imageMessage':
                forwardData = {
                    image: mediaData,
                    caption: quoted.text || '',
                    mimetype: quoted.mimetype || 'image/jpeg'
                };
                break;
            case 'videoMessage':
                forwardData = {
                    video: mediaData,
                    caption: quoted.text || '',
                    mimetype: quoted.mimetype || 'video/mp4'
                };
                break;
            case 'audioMessage':
                forwardData = {
                    audio: mediaData,
                    mimetype: 'audio/mp4',
                    ptt: quoted.ptt || false
                };
                break;
            case 'stickerMessage':
                forwardData = { sticker: mediaData };
                break;
            case 'documentMessage':
                forwardData = {
                    document: mediaData,
                    mimetype: quoted.mimetype || 'application/octet-stream',
                    fileName: quoted.fileName || 'document'
                };
                break;
            default:
                if (quoted.text || quoted.conversation) {
                    forwardData = { text: quoted.text || quoted.conversation };
                } else {
                    return reply('❌ Unsupported message type');
                }
        }

        await conn.sendMessage(senderJid, forwardData, { quoted: m });
        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });
        return reply(box('VV', ['✅ Sent to your DM!']));

    } catch (error) {
        console.error('VV ERROR:', error);
        return reply('❌ Error: ' + error.message);
    }
});

cmd({
    pattern: 'tovv',
    alias: ['toviewonce'],
    react: '📥',
    desc: 'Convert quoted media to view-once',
    category: 'tools',
    filename: __filename
}, async (conn, m, commands, { from, reply, isOwner }) => {
    try {
        const quoted = m.quoted;
        if (!quoted) {
            return reply(box('TOVV', [
                '❌ Reply to a media message with .tovv',
                '',
                '📌 Usage: .tovv (reply to image/video/audio)'
            ]));
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

        let mediaData;
        try {
            mediaData = await quoted.download();
        } catch (err) {
            return reply('❌ Download failed: ' + err.message);
        }

        const messageType = quoted.mtype || 'textMessage';
        const senderJid = m.sender;

        let forwardData = {};

        switch (messageType) {
            case 'imageMessage':
                forwardData = {
                    image: mediaData,
                    caption: quoted.text || '',
                    mimetype: quoted.mimetype || 'image/jpeg',
                    viewOnce: true
                };
                break;
            case 'videoMessage':
                forwardData = {
                    video: mediaData,
                    caption: quoted.text || '',
                    mimetype: quoted.mimetype || 'video/mp4',
                    viewOnce: true
                };
                break;
            case 'audioMessage':
                forwardData = {
                    audio: mediaData,
                    mimetype: 'audio/mp4',
                    ptt: quoted.ptt || false,
                    viewOnce: true
                };
                break;
            default:
                return reply('❌ Only image, video, and audio can be converted to view-once.');
        }

        await conn.sendMessage(senderJid, forwardData, { quoted: m });
        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });
        return reply(box('TOVV', ['✅ Sent as view-once to your DM!']));

    } catch (error) {
        console.error('TOVV ERROR:', error);
        return reply('❌ Error: ' + error.message);
    }
});
