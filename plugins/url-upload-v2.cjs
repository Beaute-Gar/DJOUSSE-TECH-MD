const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const os = require('os');
const path = require('path');

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

cmd({
    pattern: 'tourl',
    alias: ['imgtourl', 'imgurl', 'url', 'geturl', 'upload'],
    react: '💫',
    desc: 'Upload media to Catbox and get direct URL',
    category: 'tools',
    filename: __filename
}, async (conn, m, commands, { from, reply }) => {
    let tempFilePath = null;

    try {
        const quoted = m.quoted;
        if (!quoted) {
            return reply(box('TOURL', [
                '❌ Reply to a media with .tourl',
                '',
                '📌 Usage: Reply to image/video/audio/sticker'
            ]));
        }

        const quotedMsg = quoted.message || quoted;
        const mimeType = quotedMsg.mimetype || '';
        if (!mimeType) return reply(box('TOURL', ['❌ No media found.']));

        await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

        const mediaBuffer = await quoted.download();
        if (!mediaBuffer) return reply(box('TOURL', ['❌ Download failed.']));

        let extension = '';
        if (mimeType.includes('image/jpeg')) extension = '.jpg';
        else if (mimeType.includes('image/png')) extension = '.png';
        else if (mimeType.includes('video')) extension = '.mp4';
        else if (mimeType.includes('audio')) extension = '.mp3';
        else if (mimeType.includes('sticker')) extension = '.webp';
        else extension = '.bin';

        tempFilePath = path.join(os.tmpdir(), `catbox_${Date.now()}${extension}`);
        fs.writeFileSync(tempFilePath, mediaBuffer);

        const form = new FormData();
        form.append('fileToUpload', fs.createReadStream(tempFilePath), `file${extension}`);
        form.append('reqtype', 'fileupload');

        const uploadResponse = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: form.getHeaders()
        });

        const mediaUrl = uploadResponse.data.trim();

        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            tempFilePath = null;
        }

        if (!mediaUrl || !mediaUrl.startsWith('http')) {
            return reply(box('TOURL', ['❌ Upload failed.']));
        }

        let mediaType = 'File';
        if (mimeType.includes('image')) mediaType = 'Image';
        else if (mimeType.includes('video')) mediaType = 'Video';
        else if (mimeType.includes('audio')) mediaType = 'Audio';
        else if (mimeType.includes('sticker')) mediaType = 'Sticker';

        const now = new Date().toLocaleString();

        await reply(box('TOURL', [
            `TYPE: ${mediaType}`,
            `SIZE: ${formatBytes(mediaBuffer.length)}`,
            `TIME: ${now}`,
            '',
            '🔗 URL:',
            mediaUrl
        ]));

        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });

    } catch (error) {
        console.error('TOURL ERROR:', error.message);
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try { fs.unlinkSync(tempFilePath); } catch {}
        }
        return reply('❌ Upload error: ' + (error.message || 'Unknown'));
    }
});
