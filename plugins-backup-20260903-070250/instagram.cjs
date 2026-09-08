const { cmd } = require('../command.cjs');
const { box, truncate } = require('../lib/djousse-ui.cjs');

/* instagram.cjs — Téléchargement Instagram via API publique */

cmd({
  pattern: 'instagram',
  alias: ['ig', 'insta'],
  react: '📸',
  desc: 'Télécharger un post/reel Instagram',
  category: 'download',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!q || !q.includes('instagram.com')) {
    return reply(box('📸 *INSTAGRAM*', [{ label: 'Utilisation', value: '.instagram <lien Instagram>' }]));
  }
  try {
    await m.react('🕐').catch(() => {});
    const res = await fetch('https://api.davidcyriltech.my.id/instagram?url=' + encodeURIComponent(q));
    const data = await res.json();

    if (!data.success || !data.downloadUrl) {
      await m.react('❌').catch(() => {});
      return reply('❌ Échec. Lien invalide ou post privé.');
    }

    const mediaRes = await fetch(data.downloadUrl);
    const buffer = Buffer.from(await mediaRes.arrayBuffer());

    const isVideo = data.downloadUrl.includes('.mp4') || (data.result && data.result.includes('video'));
    const caption = '📸 *Instagram Download*';

    if (isVideo) {
      await conn.sendMessage(m.chat, { video: buffer, mimetype: 'video/mp4', caption }, { quoted: m });
    } else {
      await conn.sendMessage(m.chat, { image: buffer, caption }, { quoted: m });
    }
    await m.react('✅').catch(() => {});
  } catch (e) {
    await m.react('❌').catch(() => {});
    reply(box('❌ *ERREUR*', [{ raw: truncate(e.message, 200) }]));
  }
});
