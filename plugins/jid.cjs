const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { randomImage } = require('../lib/images.cjs');

cmd({
    pattern: 'jid',
    react: '🆔',
    desc: 'Get JID (user / group / channel)',
    category: 'main',
    filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
    let jid = '';
    let label = '';
    if (m.quoted && m.quoted.sender) {
        jid = m.quoted.sender;
        label = '👤 Utilisateur cité';
    } else if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
        jid = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
        label = '👥 Utilisateur mentionné';
    } else if (from && from.endsWith('@g.us')) {
        jid = from;
        label = '👨‍👩‍👧‍👦 Groupe';
    } else if (from === 'status@broadcast') {
        jid = from;
        label = '📢 Chaîne';
    } else {
        jid = m.sender || from;
        label = '🧑 Votre JID';
    }

    const text = `╭───『 🆔 JID 』───●●►
┃ ${label}
┃ ${jid}
╰─────────────❖●►
> ᴘᴏᴡᴇʀᴇᴅ ʙʏ DJOUSSE TECH`;

    try {
        await conn.sendMessage(m.chat, { image: { url: randomImage() }, caption: text }, { quoted: m });
    } catch (_) {
        await m.reply(text);
    }
});
