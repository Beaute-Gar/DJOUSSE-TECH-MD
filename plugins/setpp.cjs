const { cmd } = require('../command.cjs');
const { downloadMediaMessage } = require('../lib/msg.cjs');
const { box } = require('../lib/djousse-ui.cjs');
cmd({ pattern: 'setpp', desc: 'Changer la photo du groupe', category: 'group', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
if (!m.isGroup) return m.reply('❌ Commande réservée aux groupes.');
const quoted = m.quoted || m;
if (quoted.msg?.imageMessage || quoted.type === 'imageMessage') {
const buffer = await downloadMediaMessage(quoted, 'pp');
if (!buffer) return m.reply('❌ Erreur téléchargement image.');
await conn.updateProfilePicture(m.chat, buffer);
return m.reply(box('🖼️ *PHOTO DE GROUPE*', [
  { label: 'Statut', value: '✅ Photo mise à jour' },
]));
}
m.reply(box('🖼️ *PHOTO DE GROUPE*', [
  { raw: 'Réponds à une image avec :' },
  { raw: '.setpp' },
]));
});