const { cmd } = require('../command.cjs');
const fs = require('fs');
const DB = './database/autoreply.json';
const load = () => { try { return JSON.parse(fs.readFileSync(DB)); } catch { return {}; }};
const save = (d) => fs.writeFileSync(DB, JSON.stringify(d, null, 2));
cmd({ pattern: 'autoreply', desc: 'Gérer les réponses automatiques par mot-clé', category: 'communication', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
const args = m.body.split(' ').slice(1);
const sub = args[0]?.toLowerCase();
const data = load();
if (sub === 'add') {
const keyword = args[1];
const reply = args.slice(2).join(' ');
if (!keyword || !reply) return m.reply('❌ Usage: .autoreply add <mot-clé> <réponse>');
data[keyword.toLowerCase()] = { reply, addedBy: m.sender, date: new Date().toISOString() };
save(data);
return conn.sendMessage(m.chat, { text: `✅ Auto-reply ajouté:\n"${keyword}" → ${reply}` }, { quoted: m });
} else if (sub === 'remove' || sub === 'rm') {
const keyword = args[1]?.toLowerCase();
if (!keyword || !data[keyword]) return m.reply('❌ Mot-clé introuvable.');
delete data[keyword];
save(data);
return conn.sendMessage(m.chat, { text: `✅ Auto-reply "${keyword}" supprimé.` }, { quoted: m });
} else if (sub === 'list') {
const keys = Object.keys(data);
if (!keys.length) return m.reply('📭 Aucun auto-reply configuré.');
return conn.sendMessage(m.chat, { text: '🤖 Auto-reply configurés:\n' + keys.map(k => `- "${k}" → ${data[k].reply.slice(0,50)}`).join('\n') }, { quoted: m });
}
m.reply('🤖 Gestion auto-reply\n\n.autoreply add <mot-clé> <réponse>\n.autoreply remove <mot-clé>\n.autoreply list');
});