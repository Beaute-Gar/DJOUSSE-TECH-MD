const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
cmd({ pattern: 'setname', desc: 'Changer le nom du groupe', category: 'group', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
if (!m.isGroup) return m.reply('❌ Commande réservée aux groupes.');
const name = m.body.split(' ').slice(1).join(' ');
if (!name) return m.reply(box('📝 *NOM DU GROUPE*', [
  { raw: 'Utilisation :' },
  { raw: '.setname NouveauNom' },
]));
await conn.groupUpdateSubject(m.chat, name);
conn.sendMessage(m.chat, { text: box('📝 *NOM DU GROUPE*', [
  { label: 'Nouveau nom', value: `*${name}*` },
  { label: 'Statut', value: '✅ Mis à jour' },
]) }, { quoted: m });
});