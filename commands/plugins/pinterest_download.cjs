const { cmd } = require('../command.cjs');
const { box, truncate } = require('../lib/djousse-ui.cjs');

/* pinterest_download.cjs — Téléchargement Pinterest via giftedtech API */

cmd({
  pattern: 'pinterestdl',
  alias: ['pinterest', 'pin', 'pins'],
  react: '📌',
  desc: 'Télécharger un média Pinterest',
  category: 'download',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!q || !q.startsWith('http')) {
    return reply(box('📌 *PINTEREST*', [{ label: 'Utilisation', value: '.pinterestdl <lien Pinterest>' }]));
  }
  try {
    await m.react('🕐').catch(() => {});
    const apiUrl = 'https://api.giftedtech.web.id/api/download/pinterestdl?apikey=gifted&url=' + encodeURIComponent(q);
    const res = await fetch(apiUrl);
    const data = await res.json();

    if (!data.success || !data.result || !data.result.media || !data.result.media.length) {
      await m.react('❌').catch(() => {});
      return reply('❌ Échec. Vérifie le lien.');
    }

    const { title, description, media } = data.result;
    const video = media.find(item => item.type && item.type.includes('720p'));
    const thumbnail = media.find(item => item.type === 'Thumbnail');

    const caption = box('📌 *PINTEREST*', [
      { label: 'Titre', value: truncate(title || 'Sans titre', 100) },
      { label: 'Description', value: truncate(description || 'Aucune', 100) },
      { label: 'Type', value: video ? 'Vidéo' : 'Image' },
    ]);

    if (video && video.download_url) {
      const mediaRes = await fetch(video.download_url);
      const buffer = Buffer.from(await mediaRes.arrayBuffer());
      await conn.sendMessage(m.chat, { video: buffer, caption }, { quoted: m });
    } else if (thumbnail && thumbnail.download_url) {
      const mediaRes = await fetch(thumbnail.download_url);
      const buffer = Buffer.from(await mediaRes.arrayBuffer());
      await conn.sendMessage(m.chat, { image: buffer, caption }, { quoted: m });
    } else {
      return reply('❌ Aucun média trouvé.');
    }
    await m.react('✅').catch(() => {});
  } catch (e) {
    await m.react('❌').catch(() => {});
    reply(box('❌ *ERREUR*', [{ raw: truncate(e.message, 200) }]));
  }
});
