const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'avatar',
  alias: ['dicebear', 'ppbot'],
  react: '🎨',
  desc: 'Générer un avatar DiceBear',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { from, q, reply }) => {
  const name = (q || 'butterfly').split(' ')[0];
  const style = (q || 'butterfly adventurer').split(' ')[1] || 'adventurer';
  const avatarUrl = 'https://api.dicebear.com/6.x/' + style + '/svg?seed=' + encodeURIComponent(name);
  const caption = box('🎨 *DICEBEAR AVATAR*', [
    { label: 'Nom', value: name }, { label: 'Style', value: style },
  ]);
  await conn.sendMessage(from, { image: { url: avatarUrl }, caption }, { quoted: m });
});
