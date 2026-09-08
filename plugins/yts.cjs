const { cmd } = require('../command.cjs');
const yts = require('yt-search');
const { box, truncate } = require('../lib/djousse-ui.cjs');
const { botImg } = require('../lib/botimg.cjs');

cmd({ pattern: 'yts', alias: ['yt', 'youtubesearch'], react: '🔎', desc: 'Search YouTube videos', category: 'search', filename: __filename }, async (conn, m, commands, { from, q, reply }) => {
  try {
    if (!q) {
      return reply(box('🎬 *YOUTUBE RECHERCHE*', [
        { raw: '🔎 *Utilisation :* yts <mot-clé>' },
        { raw: '✨ *Exemple :* yts Alan Walker' },
      ]));
    }
    await reply('🔍 *SEARCHING ON YOUTUBE*\n⏳ *LOADING...*');
    const searchRes = await yts(q);
    if (!searchRes || !searchRes.all || searchRes.all.length === 0) {
      return reply(box('🎬 *YOUTUBE RECHERCHE*', [
        { raw: '❌ *Aucun résultat*' },
        { raw: '👉 *Veuillez réessayer*' },
      ]));
    }
    const results = searchRes.videos.slice(0, 10);
    const rows = [];
    rows.push({ raw: '🔎 *Recherche :* ' + truncate(q, 40) });
    results.forEach((video, i) => {
      if (i > 0) rows.push({ blank: true });
      rows.push({ label: '🎬 Titre', value: truncate(video.title, 60) });
      rows.push({ label: '⏱️ Durée', value: video.timestamp });
      rows.push({ label: '📅 Uploadé', value: video.ago });
      rows.push({ label: '🔗 Lien', value: truncate(video.url, 40) });
      rows.push({ raw: '🔗 Watch: ' + video.url });
    });
    const caption = box('🎬 *YOUTUBE RECHERCHE*', rows);
    const img = botImg();
    if (img) {
      await conn.sendMessage(from, { image: img, caption }, { quoted: m });
    } else {
      await reply(caption);
    }
  } catch (err) {
    console.error(err);
    reply(box('🎬 *YOUTUBE RECHERCHE*', [
      { raw: '❌ *YouTube search failed*' },
      { raw: '🔁 *Veuillez réessayer*' },
    ]));
  }
});
