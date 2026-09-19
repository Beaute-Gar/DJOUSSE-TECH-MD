const { cmd } = require('../command.cjs');
const os = require('os');
const { runtime } = require('../lib/functions.cjs');
const { box } = require('../lib/djousse-ui.cjs');
cmd({ pattern: 'myaccount', desc: 'Afficher les infos de ton compte', category: 'profile', filename: __filename }, async (conn, m, commands, config) => {
const user = m.sender;
const pp = await conn.profilePictureUrl(user, 'image').catch(() => '');
const name = m.pushName || user.split('@')[0];
const lines = [
  { label: 'Nom', value: name },
  { label: 'Numéro', value: user.split('@')[0] },
  { label: 'JID', value: user },
  { label: 'Photo', value: pp ? '✅' : '❌' },
  { blank: true },
  { raw: '📊 Infos bot' },
  { label: 'Uptime', value: runtime(process.uptime()) },
];
if (m.isGroup) {
const meta = await conn.groupMetadata(m.chat).catch(() => null);
if (meta) lines.push({ label: 'Groupe', value: meta.subject });
}
m.reply(box('MON COMPTE', lines));
});
