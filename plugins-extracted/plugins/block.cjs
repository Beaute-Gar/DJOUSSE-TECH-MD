const { cmd } = require('../command.cjs');
cmd({ pattern: 'block', desc: 'Bloquer un utilisateur', category: 'moderation', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
const user = m.quoted ? m.quoted.sender : (m.mention ? m.mention[0] : null);
if (!user) return m.reply('❌ Mentionne ou répond à l\'utilisateur à bloquer.\nEx: .block @user');
await conn.updateBlockStatus(user, 'block');
conn.sendMessage(m.chat, { text: `✅ @${user.split('@')[0]} bloqué avec succès.`, mentions: [user] }, { quoted: m });
});