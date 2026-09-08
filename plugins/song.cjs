const { cmd, commands } = require('../command.cjs');
const yts = require('yt-search');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const FOOTER = '│ 🤖 DJOUSSE TECH EVOLUTION';

cmd({
    pattern: 'song',
    alias: ['play', 'ytmp3', 'mp3'],
    react: '🎵',
    desc: 'Download audio from YouTube',
    category: 'DOWNLOAD',
    use: '.song <url or search query>',
    filename: __filename
}, async (conn, m, commands, { from, q, reply }) => {
    try {
        if (!q) {
            return reply('🎵 *Song Download*\n\nUsage: `.song <url or search>`\nExample: `.song despacito`');
        }

        let videoId, title, duration, thumbnail;

        const isUrl = /(youtube\.com|youtu\.be)/i.test(q);
        if (isUrl) {
            videoId = q.includes('v=') ? q.split('v=')[1].split('&')[0] : q.split('/').pop();
            const results = await yts({ videoId });
            if (results) {
                title = results.title;
                duration = results.timestamp;
                thumbnail = results.thumbnail;
            }
        } else {
            const results = await yts(q);
            if (!results.videos || !results.videos.length) {
                return reply('❌ No results found for: ' + q);
            }
            const video = results.videos[0];
            videoId = video.videoId;
            title = video.title;
            duration = video.timestamp;
            thumbnail = video.thumbnail;
        }

        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const caption = `🎵 *${title || 'Unknown'}*\n⏱️ ${duration || '?'}\n🔗 ${url}\n\n📥 Sending audio...`;

        const apiUrl = `https://api.vevioz.com/api/button/mp3/${videoId}`;

        await conn.sendMessage(from, {
            image: { url: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` },
            caption
        }, { quoted: m });

        const dlUrl = await getDownloadUrl(videoId);
        if (!dlUrl) {
            return reply('⚠️ Could not get download link. Try another song.');
        }

        const tmpFile = path.join(os.tmpdir(), `song_${Date.now()}.mp3`);
        await downloadFile(dlUrl, tmpFile);

        if (!fs.existsSync(tmpFile) || fs.statSync(tmpFile).size < 10000) {
            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
            return reply('⚠️ Download failed. Try again later.');
        }

        const audioBuffer = fs.readFileSync(tmpFile);
        await conn.sendMessage(from, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            ptt: false
        }, { quoted: m });

        fs.unlinkSync(tmpFile);
    } catch (e) {
        return reply('❌ Error: ' + e.message);
    }
});

async function getDownloadUrl(videoId) {
    return new Promise((resolve) => {
        const url = `https://api.vevioz.com/api/button/mp3/${videoId}`;
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const match = data.match(/href="(https?:\/\/[^"]*\.mp3[^"]*)"/i) ||
                              data.match(/href="(https?:\/\/[^"]*download[^"]*)"/i);
                resolve(match ? match[1] : null);
            });
        }).on('error', () => resolve(null));
    });
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(dest);
        mod.get(url, { timeout: 60000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                file.close();
                fs.unlinkSync(dest);
                return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
            }
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
            file.on('error', (e) => { if (fs.existsSync(dest)) fs.unlinkSync(dest); reject(e); });
        }).on('error', (e) => { file.close(); if (fs.existsSync(dest)) fs.unlinkSync(dest); reject(e); });
    });
}
