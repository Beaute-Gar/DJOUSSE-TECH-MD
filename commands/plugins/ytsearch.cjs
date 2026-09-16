const { cmd } = require('../command.cjs');
const axios = require('axios');

cmd({
  pattern: 'ytsearch',
  alias: ['yts'],
  react: '🔍',
  desc: 'Rechercher des vidéos YouTube',
  category: 'media',
  filename: __filename,
}, async (conn, m, commands, { from, q, reply }) => {
  if (!q) return reply('❌ Utilisation: .ytsearch <requête>');
  try {
    await m.react('🔍').catch(() => {});
    const { data } = await axios.get('https://www.dark-yasiya-api.site/search/yt?text=' + encodeURIComponent(q));
    if (!data.status || !data.result?.data?.length) return reply('❌ Aucun résultat.');
    const videos = data.result.data.slice(0, 10);
    let message = '🔍 *RÉSULTATS YOUTUBE*\n\n';
    videos.forEach((video, index) => {
      message += '*' + (index + 1) + '. ' + video.title + '*\n';
      message += '⏱️ ' + (video.duration?.timestamp || 'N/A') + ' | 👁️ ' + (video.views || 'N/A') + '\n';
      message += '👤 ' + (video.author?.name || 'N/A') + '\n';
      message += '🔗 https://youtube.com/watch?v=' + video.videoId + '\n\n';
    });
    conn.sendMessage(from, { text: message }, { quoted: m });
    await m.react('✅').catch(() => {});
  } catch (error) { reply('❌ Erreur.'); }
});
