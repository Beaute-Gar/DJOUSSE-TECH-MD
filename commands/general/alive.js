const { cmd } = require('../command.cjs');
const os = require('os');
const fs = require('fs');
const path = require('path');
const config = require('../config-djousse.cjs');

const ASSETS_DIR = path.join(__dirname, '..', '..', 'assets');
const BOT_IMAGES = [
    path.join(ASSETS_DIR, 'bot1.png'),
    path.join(ASSETS_DIR, 'bot2.png'),
];
let imageIndex = 0;

function fmtUptime(s) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m ${Math.floor(s % 60)}s`;
}

function getNextImage() {
    const available = BOT_IMAGES.filter(f => fs.existsSync(f));
    if (available.length === 0) return null;
    const img = available[imageIndex % available.length];
    imageIndex++;
    return img;
}

cmd({
    pattern: 'alive',
    alias: ['bot'],
    desc: 'Statut du bot',
    category: 'main',
    filename: __filename,
}, async (conn, m) => {
    const mem = (process.memoryUsage().rss / 1048576).toFixed(1);
    const up = fmtUptime(process.uptime());
    const version = config.VERSION || 'v3.1.0';
    const botName = (config.BOT_NAME || 'DJOUSSE-TECH-MD').toUpperCase();
    const ownerName = config.OWNER_NAME || 'DJOUSSE';

    const text = `╭───『 ${botName} 』───●●►
┃ 🟢 *STATUS : ONLINE*
┃ 🤖 Bot : ${botName}
┃ 👤 Owner : ${ownerName}
┃ 📦 Version : ${version}
┃ ⏱️ Uptime : ${up}
┃ 💾 RAM : ${mem} MB
┃ 💻 OS : ${os.type()} ${os.release()}
╰─────────────❖●►
> ᴘᴏᴡᴇʀᴇᴅ ʙʏ DJOUSSE TECH`;

    const imgPath = getNextImage();
    try {
        if (imgPath) {
            await conn.sendMessage(m.chat, { image: { url: imgPath }, caption: text }, { quoted: m });
        } else {
            await m.reply(text);
        }
    } catch (_) {
        await m.reply(text);
    }
});
