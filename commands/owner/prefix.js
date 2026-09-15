const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
cmd({ pattern: 'prefix', desc: 'Changer le préfixe des commandes', category: 'admin', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
const args = m.body.split(' ').slice(1);
const newPrefix = args[0];
if (!newPrefix || newPrefix.length > 2) return m.reply(box('#️⃣ *PRÉFIXE*', [
  { label: 'Ancien', value: `*${process.env.PREFIX || '.'}*` },
  { blank: true },
  { raw: 'Utilisation :' },
  { raw: '.prefix <nouveau préfixe>' },
  { blank: true },
  { raw: 'Ex : .prefix !' },
]));
process.env.PREFIX = newPrefix;
conn.sendMessage(m.chat, { text: box('#️⃣ *PRÉFIXE*', [
  { label: 'Ancien', value: `*${process.env.PREFIX === newPrefix ? '.' : 'non défini'}*` },
  { label: 'Nouveau', value: `*${newPrefix}*` },
  { label: 'Statut', value: '✅ Mis à jour' },
]) }, { quoted: m });
});