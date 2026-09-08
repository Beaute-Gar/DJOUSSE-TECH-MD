const { cmd } = require('../command.cjs');
const fs = require('fs');
const DB = './database/warns.json';
const loadWarns = () => { try { return JSON.parse(fs.readFileSync(DB)); } catch { return {}; }};
cmd({ pattern: 'warnings', desc: 'Lister les avertissements', category: 'moderation', filename: __filename }, async (conn, m, commands, config) => {
const warns = loadWarns();
const user = m.quoted ? m.quoted.sender : (m.mention ? m.mention[0] : null);
if (user) {
const list = warns[user];
if (!list || list.length === 0) return conn.sendMessage(m.chat, { text: `✅ @${user.split('@')[0]} n'a aucun avertissement.`, mentions: [user] }, { quoted: m });
let msg = `⚠️ Avertissements pour @${user.split('@')[0]}:\n`;
list.forEach((w, i) => msg += `${i+1}. ${w.reason} (${new Date(w.date).toLocaleDateString()})\n`);
return m.reply(msg, m.chat, { mentions: [user] });
}
const entries = Object.entries(warns).filter(([k,v]) => v.length > 0);
if (entries.length === 0) return m.reply('✅ Aucun avertissement enregistré.');
let msg = '📋 Liste des avertissements:\n';
entries.forEach(([uid, list]) => msg += `- @${uid.split('@')[0]}: ${list.length}/3\n`);
conn.sendMessage(m.chat, { text: msg, mentions: entries.map(e => e[0]) }, { quoted: m });
});