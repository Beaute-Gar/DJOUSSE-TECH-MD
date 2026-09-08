const { cmd } = require('../command.cjs');
cmd({ pattern: 'unblock', desc: 'Débloquer un utilisateur', category: 'moderation', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
const user = m.quoted ? m.quoted.sender : (m.mention ? m.mention[0] : null);
if (!user) return m.reply('❌ Mentionne ou répond à l\'utilisateur à débloquer.\nEx: .unblock @user');
await conn.updateBlockStatus(user, 'unblock');
conn.sendMessage(m.chat, { text: `✅ @${user.split('@')[0]} débloqué avec succès.`, mentions: [user] }, { quoted: m });
});