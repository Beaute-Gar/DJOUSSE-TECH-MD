const { cmd } = require('../command.cjs');
const os = require('os');
const config = require('../config-djousse.cjs');
const { randomImage } = require('../lib/images.cjs');

cmd({
    pattern: 'ping',
    alias: ['p'],
    desc: 'Vérifier la latence',
    category: 'main',
    filename: __filename,
}, async (conn, m) => {
    const start = Date.now();
    const botName = (config.BOT_NAME || 'DJOUSSE-TECH-MD').toUpperCase();
    const mem = (process.memoryUsage().rss / 1048576).toFixed(1);

    const text = `╭───『 ⚡ PING 』───●●►
┃ 🟢 *STATUS : ONLINE*
┃ ⚡ Latence : ${Date.now() - start}ms
┃ 💻 Serveur : ${os.hostname() || 'Render'}
┃ 💾 RAM : ${mem} MB
╰─────────────❖●►
> ᴘᴏᴡᴇʀᴇᴅ ʙʏ DJOUSSE TECH`;

    try {
        await conn.sendMessage(m.chat, { image: { url: randomImage() }, caption: text }, { quoted: m });
    } catch (_) {
        await m.reply(text);
    }
});
