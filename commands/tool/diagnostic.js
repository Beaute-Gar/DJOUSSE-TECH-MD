const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { randomImage } = require('../lib/images.cjs');

const TZ = 'Africa/Douala';

cmd({
    pattern: 'time',
    alias: ['heure'],
    desc: 'Heure actuelle',
    category: 'main',
    filename: __filename,
}, async (conn, m) => {
    const now = new Date();
    const time = now.toLocaleTimeString('fr-FR', { timeZone: TZ });
    const text = `╭───『 🕐 TIME 』───●●►
┃ ⏰ *Heure :* ${time}
┃ 🌍 *Timezone :* ${TZ}
╰─────────────❖●►
> ᴘᴏᴡᴇʀᴇᴅ ʙʏ DJOUSSE TECH`;

    try {
        await conn.sendMessage(m.chat, { image: { url: randomImage() }, caption: text }, { quoted: m });
    } catch (_) {
        await m.reply(text);
    }
});

cmd({
    pattern: 'date',
    alias: ['jour'],
    desc: 'Date actuelle',
    category: 'main',
    filename: __filename,
}, async (conn, m) => {
    const now = new Date();
    const date = now.toLocaleDateString('fr-FR', { timeZone: TZ, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const text = `╭───『 📅 DATE 』───●●►
┃ 📆 *Date :* ${date}
┃ 🌍 *Timezone :* ${TZ}
╰─────────────❖●►
> ᴘᴏᴡᴇʀᴇᴅ ʙʏ DJOUSSE TECH`;

    try {
        await conn.sendMessage(m.chat, { image: { url: randomImage() }, caption: text }, { quoted: m });
    } catch (_) {
        await m.reply(text);
    }
});

cmd({
    pattern: 'diagnostic',
    alias: ['diag', 'health'],
    desc: 'Diagnostiquer le bot',
    category: 'main',
    filename: __filename,
}, async (conn, m) => {
    const mem = (process.memoryUsage().rss / 1048576).toFixed(1);
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600), mi = Math.floor((uptime % 3600) / 60);
    const aiKey = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY ? '✅' : '❌';
    const ws = conn.ws?.readyState === 1 ? '🟢 Connecté' : '🔴 Déconnecté';

    const text = `╭───『 🔍 DIAGNOSTIC 』───●●►
┃ 🌐 WebSocket : ${ws}
┃ 💾 RAM : ${mem} MB
┃ ⏱️ Uptime : ${h}h ${mi}m
┃ 🤖 IA Keys : ${aiKey}
┃ 📚 Commandes : ${require('../command.cjs').commands.length}
╰─────────────❖●►
> ᴘᴏᴡᴇʀᴇᴅ ʙʏ DJOUSSE TECH`;

    try {
        await conn.sendMessage(m.chat, { image: { url: randomImage() }, caption: text }, { quoted: m });
    } catch (_) {
        await m.reply(text);
    }
});
