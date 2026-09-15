const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'statusreply',
  react: '💬',
  desc: 'Définir la réponse automatique au statut',
  category: 'owner',
  filename: __filename,
  fromMe: true,
}, async (conn, m, commands, config) => {
  const args = m.body.split(' ').slice(1);
  const text = args.join(' ');
  if (!text) return conn.sendMessage(m.chat, { text: box('💬 *STATUS REPLY*', [
    { raw: '.statusreply <message>' },
  ]) }, { quoted: m });
  config.STATUS_READ_MSG = text;
  conn.sendMessage(m.chat, { text: box('✅ *STATUS REPLY DÉFINI*', [
    { label: 'Message', value: text }, { label: 'Statut', value: '✅ Mis à jour' },
  ]) }, { quoted: m });
});
