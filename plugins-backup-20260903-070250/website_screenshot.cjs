const { cmd, commands } = require('../command');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

cmd({
    pattern: 'screenshot',
    alias: ['ss', 'ssweb', 'screenshott'],
    react: '📸',
    desc: 'Take a screenshot of a website',
    category: 'MATHTOOL',
    use: '.screenshot <url>',
    filename: __filename
}, async (conn, m, commands, { from, q, reply }) => {
    try {
        if (!q) {
            return reply(
                '📸 *Website Screenshot*\n\n' +
                'Usage: `.screenshot <url>`\n' +
                'Example: `.screenshot https://google.com`'
            );
        }

        let url = q.trim();
        if (!url.startsWith('http')) url = 'https://' + url;

        new URL(url);

        await reply('📸 Taking screenshot...');

        const thumbUrl = `https://image.thum.io/get/width/1280/crop/800/${url}`;
        const tmpFile = path.join(os.tmpdir(), `ss_${Date.now()}.png`);

        await downloadFile(thumbUrl, tmpFile);

        if (!fs.existsSync(tmpFile) || fs.statSync(tmpFile).size < 1000) {
            return reply('❌ Failed to take screenshot. URL may be invalid or blocked.');
        }

        const imgBuffer = fs.readFileSync(tmpFile);
        await conn.sendMessage(from, {
            image: imgBuffer,
            caption: `📸 *Screenshot*\n🌐 ${url}`
        }, { quoted: m });

        fs.unlinkSync(tmpFile);
    } catch (e) {
        return reply('❌ Error: ' + e.message);
    }
});

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(dest);
        mod.get(url, { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                file.close();
                fs.unlinkSync(dest);
                return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                file.close();
                fs.unlinkSync(dest);
                return reject(new Error('HTTP ' + res.statusCode));
            }
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
            file.on('error', (e) => { fs.unlinkSync(dest); reject(e); });
        }).on('error', (e) => { file.close(); if (fs.existsSync(dest)) fs.unlinkSync(dest); reject(e); });
    });
}
