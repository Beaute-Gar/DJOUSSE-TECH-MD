const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const axios = require('axios');

cmd({
  pattern: 'lyric',
  alias: ['lyrics'],
  react: '🎵',
  desc: 'Paroles de musique',
  category: 'media',
  filename: __filename,
}, async (conn, m, commands, { from, q, reply }) => {
  if (!q || !q.includes('|')) return reply(box('🎵 *LYRICS*', [
    { raw: 'Utilisation :' }, { raw: '.lyric <titre> | <artiste>' },
  ]));
  try {
    await m.react('🎵').catch(() => {});
    const [title, artist] = q.split('|').map(part => part.trim());
    const { data } = await axios.get('https://api.lyrics.ovh/v1/' + encodeURIComponent(artist) + '/' + encodeURIComponent(title));
    if (data && data.lyrics) {
      const lyrics = data.lyrics.length > 2000 ? data.lyrics.substring(0, 2000) + '...' : data.lyrics;
      reply(box('🎵 *PAROLES*', [
        { label: 'Titre', value: title }, { label: 'Artiste', value: artist },
        { blank: true }, { raw: lyrics },
      ]));
      await m.react('✅').catch(() => {});
    } else { reply('❌ Paroles non trouvées.'); }
  } catch (error) { reply('❌ Erreur: ' + error.message); }
});
