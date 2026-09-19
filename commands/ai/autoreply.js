const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');
const fs = require('fs');
const DB = './database/autoreply.json';
const load = () => { try { return JSON.parse(fs.readFileSync(DB)); } catch { return {}; }};
const save = (d) => fs.writeFileSync(DB, JSON.stringify(d, null, 2));
cmd({ pattern: 'autoreplymanage', alias: ['arm', 'autoreplycmd'], desc: 'Gérer les réponses automatiques par mot-clé', category: 'communication', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
const args = m.body.split(' ').slice(1);
const sub = args[0]?.toLowerCase();
const data = load();
if (sub === 'add') {
const keyword = args[1];
const reply = args.slice(2).join(' ');
if (!keyword || !reply) return m.reply(boxWithFooter('ERROR', [{ raw: '❌ Usage: .autoreply add <mot-clé> <réponse>' }]));
data[keyword.toLowerCase()] = { reply, addedBy: m.sender, date: new Date().toISOString() };
save(data);
return conn.sendMessage(m.chat, { text: boxWithFooter('SUCCESS', [{ raw: `✅ Auto-reply ajouté:\n"${keyword}" → ${reply}` }]) }, { quoted: m });
} else if (sub === 'remove' || sub === 'rm') {
const keyword = args[1]?.toLowerCase();
if (!keyword || !data[keyword]) return m.reply(boxWithFooter('ERROR', [{ raw: '❌ Mot-clé introuvable.' }]));
delete data[keyword];
save(data);
return conn.sendMessage(m.chat, { text: boxWithFooter('SUCCESS', [{ raw: `✅ Auto-reply "${keyword}" supprimé.` }]) }, { quoted: m });
} else if (sub === 'list') {
const keys = Object.keys(data);
if (!keys.length) return m.reply(boxWithFooter('AUTO-REPLY', [{ raw: '📭 Aucun auto-reply configuré.' }]));
return conn.sendMessage(m.chat, { text: boxWithFooter('AUTO-REPLY', keys.map(k => ({ raw: `"${k}" → ${data[k].reply.slice(0,50)}` }))) }, { quoted: m });
}
m.reply(boxWithFooter('AUTO-REPLY', [{ cmd: 'autoreply add <mot-clé> <réponse>' }, { cmd: 'autoreply remove <mot-clé>' }, { cmd: 'autoreply list' }]));
});