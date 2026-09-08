const { cmd } = require('../command.cjs');
const fs = require('fs');
const DB = './database/warns.json';
const loadWarns = () => { try { return JSON.parse(fs.readFileSync(DB)); } catch { return {}; }};
const saveWarns = (d) => fs.writeFileSync(DB, JSON.stringify(d, null, 2));
cmd({ pattern: 'warn', desc: 'Avertir un utilisateur (3 warns = kick)', category: 'moderation', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
const user = m.quoted ? m.quoted.sender : (m.mention ? m.mention[0] : null);
if (!user) return m.reply('❌ Mentionne ou répond à l\'utilisateur.');
const warns = loadWarns();
if (!warns[user]) warns[user] = [];
const reason = m.body.split(' ').slice(1).filter(s => !s.startsWith('@')).join(' ') || 'Aucune raison';
warns[user].push({ reason, date: new Date().toISOString(), by: m.sender });
saveWarns(warns);
const count = warns[user].length;
if (count >= 3) {
await conn.groupParticipantsUpdate(m.chat, [user], 'remove');
warns[user] = [];
saveWarns(warns);
return conn.sendMessage(m.chat, { text: `⛔ @${user.split('@')[0]} a atteint 3 warns → expulsé.`, mentions: [user] }, { quoted: m });
}
conn.sendMessage(m.chat, { text: `⚠️ @${user.split('@')[0]} averti (${count}/3).\nRaison: ${reason}`, mentions: [user] }, { quoted: m });
});