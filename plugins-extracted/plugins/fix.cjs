const { cmd } = require('../command.cjs');
cmd({ pattern: 'fix', desc: 'Corriger le message du bot en cas d\'erreur', category: 'media', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
if (!m.quoted) return m.reply('❌ Réponds au message du bot à corriger.');
const fix = m.body.split(' ').slice(1).join(' ');
if (!fix) return m.reply('❌ Usage: .fix <message corrigé>');
await conn.sendMessage(m.chat, { text: fix, edit: m.quoted.key }, { quoted: m });
});