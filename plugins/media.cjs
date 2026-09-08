const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const axios = require('axios');
const yts = require('yt-search');
const BASE_URL = 'https://noobs-api.top';

cmd({
  pattern: 'play',
  alias: ['music', 'song'],
  react: '🎵',
  desc: 'Télécharger une musique YouTube',
  category: 'media',
  filename: __filename,
}, async (conn, m, commands, { from, q, reply }) => {
  if (!q) return reply(box('🎵 *PLAY / MUSIC*', [
    { raw: 'Utilisation :' }, { raw: '.play <titre>' },
  ]));
  try {
    await m.react('⏳').catch(() => {});
    const search = await yts(q);
    const video = search.videos[0];
    if (!video) return reply('❌ Aucune vidéo trouvée.');
    const apiUrl = BASE_URL + '/dipto/ytDl3?link=' + encodeURIComponent(video.videoId) + '&format=mp3';
    const { data } = await axios.get(apiUrl);
    if (!data.downloadLink) return reply('❌ Erreur: lien vide.');
    const caption = box('🎵 *MUSIC*', [
      { label: 'Titre', value: video.title },
      { label: 'Artiste', value: video.author.name },
      { label: 'Durée', value: video.timestamp },
    ]);
    await conn.sendMessage(from, { image: { url: video.thumbnail }, caption }, { quoted: m });
    await conn.sendMessage(from, { audio: { url: data.downloadLink }, mimetype: 'audio/mpeg', fileName: video.title.replace(/[\\/:*?"<>|]/g, '') + '.mp3' }, { quoted: m });
    await m.react('🎵').catch(() => {});
  } catch (e) { reply('❌ Erreur: ' + e.message); }
});

cmd({
  pattern: 'video',
  alias: ['vid', 'mp4'],
  react: '🎬',
  desc: 'Télécharger une vidéo YouTube',
  category: 'media',
  filename: __filename,
}, async (conn, m, commands, { from, q, reply }) => {
  if (!q) return reply(box('🎬 *VIDEO*', [
    { raw: 'Utilisation :' }, { raw: '.video <titre>' },
  ]));
  try {
    await m.react('⏳').catch(() => {});
    const search = await yts(q);
    const video = search.videos[0];
    if (!video) return reply('❌ Aucune vidéo trouvée.');
    const apiUrl = BASE_URL + '/dipto/ytDl3?link=' + encodeURIComponent(video.videoId) + '&format=mp4';
    const { data } = await axios.get(apiUrl);
    if (!data.downloadLink) return reply('❌ Erreur: lien vide.');
    const caption = box('🎬 *VIDEO*', [
      { label: 'Titre', value: video.title },
      { label: 'Artiste', value: video.author.name },
      { label: 'Durée', value: video.timestamp },
    ]);
    await conn.sendMessage(from, { image: { url: video.thumbnail }, caption }, { quoted: m });
    await conn.sendMessage(from, { video: { url: data.downloadLink }, mimetype: 'video/mp4', fileName: video.title.replace(/[\\/:*?"<>|]/g, '') + '.mp4' }, { quoted: m });
    await m.react('🎬').catch(() => {});
  } catch (e) { reply('❌ Erreur: ' + e.message); }
});
