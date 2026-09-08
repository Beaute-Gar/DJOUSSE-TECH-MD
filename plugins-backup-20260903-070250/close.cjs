const { cmd } = require('../command.cjs');
cmd({ pattern: 'close', desc: 'Fermer le groupe (admin seulement)', category: 'group', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
if (!m.isGroup) return m.reply('❌ Cette commande est réservée aux groupes.');
await conn.groupSettingUpdate(m.chat, 'announcement');
m.reply('🔒 Groupe fermé. Seuls les admins peuvent envoyer des messages.');
});