const { cmd } = require('../command.cjs');
const fs = require('fs');
const DB = './database/deals.json';
const load = () => { try { return JSON.parse(fs.readFileSync(DB)); } catch { return []; }};
const save = (d) => fs.writeFileSync(DB, JSON.stringify(d, null, 2));
cmd({ pattern: 'deal', desc: 'Gérer les deals/offres', category: 'business', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
const args = m.body.split(' ').slice(1);
const sub = args[0]?.toLowerCase();
if (sub === 'add') {
const title = args.slice(1).join(' ');
if (!title) return m.reply('❌ Usage: .deal add Titre de l\'offre');
const list = load();
list.push({ id: Date.now(), title, date: new Date().toISOString() });
save(list);
return conn.sendMessage(m.chat, { text: `✅ Offre ajoutée: ${title}` }, { quoted: m });
} else if (sub === 'list') {
const list = load();
if (!list.length) return m.reply('📭 Aucune offre.');
return conn.sendMessage(m.chat, { text: '🏷️ Offres:\n' + list.map((d,i) => `${i+1}. ${d.title} (${new Date(d.date).toLocaleDateString()})`).join('\n') }, { quoted: m });
}
m.reply('🏷️ Gestion des deals\n\n.deal add <titre>\n.deal list');
});