const { cmd } = require('../command.cjs');
const fs = require('fs');
const DB = './database/blacklist.json';
const load = () => { try { return JSON.parse(fs.readFileSync(DB)); } catch { return []; }};
const save = (d) => fs.writeFileSync(DB, JSON.stringify(d, null, 2));
cmd({ pattern: 'blacklist', desc: 'Gérer la blacklist (add/remove/list)', category: 'moderation', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
const args = m.body.split(' ').slice(1);
const sub = args[0]?.toLowerCase();
if (sub === 'add') {
const user = m.quoted ? m.quoted.sender : (m.mention ? m.mention[0] : args[1]);
if (!user || !user.includes('@')) return m.reply('Utilisation: .blacklist add @user');
const list = load();
if (!list.includes(user)) { list.push(user); save(list); }
return conn.sendMessage(m.chat, { text: `✅ @${user.split('@')[0]} ajouté à la blacklist.`, mentions: [user] }, { quoted: m });
} else if (sub === 'remove' || sub === 'rm') {
const user = m.quoted ? m.quoted.sender : (m.mention ? m.mention[0] : args[1]);
if (!user) return m.reply('Utilisation: .blacklist remove @user');
const list = load().filter(j => j !== user);
save(list);
return conn.sendMessage(m.chat, { text: `✅ @${user.split('@')[0]} retiré de la blacklist.`, mentions: [user] }, { quoted: m });
}
const list = load();
if (list.length === 0) return m.reply('✅ Blacklist vide.');
conn.sendMessage(m.chat, { text: `🚫 Blacklist (${list.length}):\n${list.map(j => `- @${j.split('@')[0]}`).join('\n')}`, mentions: list }, { quoted: m });
});