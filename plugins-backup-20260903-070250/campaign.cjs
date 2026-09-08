const { cmd } = require('../command.cjs');
const fs = require('fs');
const DB = './database/campaigns.json';
const load = () => { try { return JSON.parse(fs.readFileSync(DB)); } catch { return []; }};
const save = (d) => fs.writeFileSync(DB, JSON.stringify(d, null, 2));
cmd({ pattern: 'campaign', desc: 'Gérer les campagnes marketing', category: 'business', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
const args = m.body.split(' ').slice(1);
const sub = args[0]?.toLowerCase();
if (sub === 'new') {
const name = args.slice(1).join(' ');
if (!name) return m.reply('❌ Usage: .campaign new NomCampagne');
const list = load();
list.push({ id: Date.now(), name, created: new Date().toISOString(), status: 'active', sent: 0 });
save(list);
return conn.sendMessage(m.chat, { text: `✅ Campagne "${name}" créée !` }, { quoted: m });
} else if (sub === 'list') {
const list = load();
if (!list.length) return m.reply('📭 Aucune campagne.');
const msg = '📋 Campagnes:\n' + list.map((c,i) => `${i+1}. ${c.name} [${c.status}] - Envoyé: ${c.sent}`).join('\n');
return m.reply(msg);
}
m.reply('📊 Gestion des campagnes\n\nCommandes:\n.campaign new <nom>\n.campaign list');
});