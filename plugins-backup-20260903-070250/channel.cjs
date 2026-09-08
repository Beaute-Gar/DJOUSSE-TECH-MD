const { cmd } = require('../command.cjs');
cmd({ pattern: 'channel', desc: 'Gérer les chaînes WhatsApp', category: 'communication', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
const args = m.body.split(' ').slice(1);
const sub = args[0]?.toLowerCase();
if (sub === 'follow' && args[1]) {
try { await conn.newsletterFollow(args[1]); return m.reply(`✅ Suivi de la chaîne activé.`); }
catch (e) { return conn.sendMessage(m.chat, { text: `❌ Erreur: ${e.message}` }, { quoted: m }); }
} else if (sub === 'unfollow' && args[1]) {
try { await conn.newsletterUnfollow(args[1]); return m.reply(`✅ Chaîne retirée des suivis.`); }
catch (e) { return conn.sendMessage(m.chat, { text: `❌ Erreur: ${e.message}` }, { quoted: m }); }
} else if (sub === 'list') {
const subs = await conn.newsletterSubscriptions();
return conn.sendMessage(m.chat, { text: '📡 Chaînes suivies:\n' + (subs?.length ? subs.map(s => `- ${s.name || s.id}`).join('\n') : 'Aucune.') }, { quoted: m });
}
m.reply('📡 Gestion des chaînes\n\n.channel follow <id>\n.channel unfollow <id>\n.channel list');
});