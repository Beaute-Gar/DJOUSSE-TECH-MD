const { cmd } = require('../command.cjs');
const fs = require('fs');
const DB = './database/warns.json';
const loadWarns = () => { try { return JSON.parse(fs.readFileSync(DB)); } catch { return {}; }};
const saveWarns = (d) => fs.writeFileSync(DB, JSON.stringify(d, null, 2));
cmd({ pattern: 'unwarn', desc: 'Enlever un avertissement', category: 'moderation', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
const user = m.quoted ? m.quoted.sender : (m.mention ? m.mention[0] : null);
if (!user) return m.reply('❌ Mentionne ou répond à l\'utilisateur.');
const warns = loadWarns();
if (!warns[user] || warns[user].length === 0) return m.reply('✅ Cet utilisateur n\'a aucun avertissement.');
warns[user].pop();
if (warns[user].length === 0) delete warns[user];
saveWarns(warns);
conn.sendMessage(m.chat, { text: `✅ Avertissement retiré. Restant: ${warns[user]?.length || 0}/3` }, { quoted: m });
});