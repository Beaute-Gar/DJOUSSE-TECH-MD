'use strict';

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { dlBuffer } = require('../_partage/dlmedia');
const style = require('../../config/style');

module.exports = {
    commands: ['tomp3', 'audio'],
    description: 'Convert a video or voice message to an MP3 audio file',
    usage: '.tomp3 (reply to a video or audio message)',
    permission: 'public',
    group: true,
    private: true,

    run: async (sock, message, args, { jid, contextInfo }) => {
        const msg = message.message;
        const quoted = msg?.extendedTextMessage?.contextInfo?.quotedMessage;
        const video = msg?.videoMessage || quoted?.videoMessage;
        const audio = msg?.audioMessage || quoted?.audioMessage;
        const target = video || audio;
        const mediaType = video ? 'video' : audio ? 'audio' : null;

        const sendNotice = (text, renderer) => sock.sendMessage(
            jid,
            { text: renderer([text]), contextInfo },
            { quoted: message },
        );

        if (!target || !mediaType) {
            return sendNotice('Reply to a video or audio/voice message with `.tomp3`.', style.renderError);
        }

        await sendNotice('Converting to audio…', style.renderInfo);

        const inputPath = path.join(os.tmpdir(), `djou_in_${Date.now()}`);
        const outputPath = path.join(os.tmpdir(), `djou_out_${Date.now()}.mp3`);

        try {
            await sock.sendPresenceUpdate('composing', jid);
            const buffer = await dlBuffer(target, mediaType);
            fs.writeFileSync(inputPath, buffer);

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .noVideo()
                    .audioCodec('libmp3lame')
                    .audioBitrate(128)
                    .output(outputPath)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });

            await sock.sendMessage(jid, {
                audio: fs.readFileSync(outputPath),
                mimetype: 'audio/mpeg',
                ptt: false,
            }, { quoted: message });

            await sock.sendPresenceUpdate('paused', jid);
        } catch (error) {
            console.error('[ToAudio]', error.message);
            await sendNotice(`Conversion failed: ${error.message}`, style.renderError);
        } finally {
            if (fs.existsSync(inputPath)) {
                try { fs.unlinkSync(inputPath); } catch {}
            }
            if (fs.existsSync(outputPath)) {
                try { fs.unlinkSync(outputPath); } catch {}
            }
        }
    },
};
