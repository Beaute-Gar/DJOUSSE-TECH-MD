const { cmd } = require('../command.cjs');
const os = require('os');
const config = require('../config-djousse.cjs');

cmd({
    pattern: 'developer',
    alias: ['dev', 'beaute', 'gar'],
    desc: 'Informations sur le développeur',
    category: 'main',
    filename: __filename,
}, async (conn, m) => {
    const text = `╭───『 👨‍💻 DEVELOPER 』───●●►
┃ 👤 *Nom :* Beaute Gar
┃ 🌍 *Pays :* Cameroun
┃ 📱 *WhatsApp :* 237693978044
┃ 🔧 *Rôle :* Fondateur & Développeur
┃ 📦 *Bot :* ${config.BOT_NAME || 'DJOUSSE TECH'}
┃ ⚡ *Version :* ${config.VERSION || 'v3.0.0'}
╰─────────────❖●►
> ᴘᴏᴡᴇʀᴇᴅ ʙʏ DJOUSSE TECH`;

    try {
        await m.reply(text);
    } catch (_) {
        await conn.sendMessage(m.chat, { text }, { quoted: m });
    }
});
