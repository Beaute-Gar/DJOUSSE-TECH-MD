const { cmd } = require('../command.cjs');
cmd({ pattern: 'select', desc: 'Sélectionner une option parmi une liste', category: 'utility', filename: __filename }, async (conn, m, commands, config) => {
const args = m.body.split(' ').slice(1);
const nums = args.filter(a => /^\d+$/.test(a)).map(Number);
const text = args.filter(a => !/^\d+$/.test(a)).join(' ');
if (nums.length === 0 && !text) return conn.sendMessage(m.chat, { text: '❌ Usage: .select 1 3 5\nou .select option1, option2, option3' }, { quoted: m });
if (nums.length > 0) {
const total = Math.max(...nums);
let msg = '🔀 Sélection aléatoire:\n\n';
nums.forEach(n => {
const rand = Math.floor(Math.random() * total) + 1;
msg += `Choix ${n}: ${rand}\n`;
});
return m.reply(msg);
}
if (text) {
const options = text.split(',').map(s => s.trim()).filter(s => s);
if (options.length < 2) return m.reply('❌ Sépare les options par des virgules.');
const chosen = options[Math.floor(Math.random() * options.length)];
conn.sendMessage(m.chat, { text: `🎯 Choix aléatoire:\n\n${options.map((o,i) => `${i+1}. ${o}`).join('\n')}\n\n➡️ **${chosen}**` }, { quoted: m });
}
});