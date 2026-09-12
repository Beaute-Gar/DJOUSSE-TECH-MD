const { cmd } = require('../command.cjs');
const os = require('os');
const config = require('../config-djousse.cjs');
const { randomImage } = require('../lib/images.cjs');

function fmtUptime(s) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m ${Math.floor(s % 60)}s`;
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
    const ownerName = config.OWNER_NAME || 'DJOUSSSE';

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

    try {
        await conn.sendMessage(m.chat, { image: { url: randomImage() }, caption: text }, { quoted: m });
    } catch (_) {
        await m.reply(text);
    }
});
