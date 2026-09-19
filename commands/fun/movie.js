const { cmd } = require('../command.cjs');
const axios = require('axios');
const { box, boxWithFooter, truncate } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'movie',
  alias: ['film', 'movies'],
  react: '🎬',
  desc: 'Infos film/serie via OMDB',
  category: 'search',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  try {
    if (!q) return reply(boxWithFooter('🎬 *INFOS FILM*', [
      { raw: 'Utilisation :' },
      { raw: '.movie <titre>' },
      { blank: true },
      { raw: 'Exemple :' },
      { raw: '.movie inception' },
    ]));

    await m.react('⏳').catch(() => {});

    const { data } = await axios.get('http://www.omdbapi.com/', {
      params: { apikey: process.env.OMDB_API_KEY || '742b2d09', t: q, plot: 'full' },
    });

    if (data.Response === 'False') return reply(boxWithFooter('ERREUR', [{ raw: `❌ Film/serie introuvable : ${q}` }]));

    const poster = data.Poster && data.Poster !== 'N/A' ? data.Poster : null;

    const info = box('🎬 *' + data.Title + '*', [
      { label: 'Année', value: data.Year },
      { label: 'Rated', value: data.Rated },
      { label: 'Sortie', value: data.Released },
      { label: 'Durée', value: data.Runtime },
      { label: 'Genre', value: data.Genre },
      { label: 'Réalisateur', value: data.Director },
      { label: 'Scénariste', value: data.Writer },
      { label: 'Acteurs', value: data.Actors },
      { blank: true },
      { label: 'Résumé', value: truncate(data.Plot, 300) },
      { blank: true },
      { label: 'Langue', value: data.Language },
      { label: 'Pays', value: data.Country },
      { label: 'Prix', value: data.Awards },
      { label: 'Box Office', value: data.BoxOffice || 'N/A' },
      { label: 'Production', value: data.Production || 'N/A' },
      { label: 'IMDB', value: data.imdbRating + '/10 (' + data.imdbVotes + ' votes)' },
    ]);

    if (poster) {
      await conn.sendMessage(m.chat, { image: { url: poster }, caption: info }, { quoted: m });
    } else {
      await conn.sendMessage(m.chat, { text: info }, { quoted: m });
    }

    await m.react('✅').catch(() => {});
  } catch (e) {
    await m.react('❌').catch(() => {});
    reply(boxWithFooter('ERREUR', [{ raw: `❌ Erreur: ${e.message}` }]));
  }
});
