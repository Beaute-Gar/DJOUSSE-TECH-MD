const { cmd, commands } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { randomImage } = require('../lib/images.cjs');

cmd({
    pattern: 'developer',
    alias: ['dev', 'devinfo'],
    desc: 'Informations du développeur',
    category: 'main',
    filename: __filename,
}, async (conn, m) => {
    const owner = config.BOT_OWNER || config.OWNER_NUMBER || '';
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600), mi = Math.floor((uptime % 3600) / 60), s = Math.floor(uptime % 60);
    const mem = Math.round(process.memoryUsage().rss / 1024 / 1024);
    const total = commands.length;

    const text = `╭───『 👨‍💻 DEVELOPER 』───●●►
┃ 👑 *Beaute Gar*
┃ 🤖 Bot : ${config.BOT_NAME || 'DJOUSSE-TECH-MD'}
┃ 📱 Owner : ${owner}
┃ ⏱️ Uptime : ${h}h ${mi}m ${s}s
┃ 💾 RAM : ${mem} MB
┃ 📚 Commandes : ${total}
╰─────────────❖●►
> © DJOUSSE TECH EVOLUTION`;

    try {
        await conn.sendMessage(m.chat, { image: { url: randomImage() }, caption: text }, { quoted: m });
    } catch (_) {
        await m.reply(text);
    }
});
