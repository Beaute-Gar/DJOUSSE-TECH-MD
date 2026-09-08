const { cmd } = require('../command.cjs');
const axios = require('axios');
const { box, truncate } = require('../lib/djousse-ui.cjs');

cmd({ pattern: 'movie', alias: ['film', 'movies'], category: 'movie', filename: __filename }, async (conn, m, commands, { q, reply }) => {
  try {
    if (!q) return reply(box('🎬 *INFOS FILM*', [
      { raw: 'Utilisation :' },
      { raw: '.movie <titre>' },
      { blank: true },
      { raw: 'Exemple :' },
      { raw: '.movie inception' },
    ]));
    const r = await axios.get('https://api.duckduckgo.com/', {
      params: { q: q + ' film', format: 'json', no_html: 1 },
      timeout: 20000,
    });
    const data = r.data || {};
    const title = (data.Heading || q).replace(/[-_]/g, ' ');
    const abstract = (data.AbstractText || data.RelatedTopics?.[0]?.Text || '').trim();
    const rows = [
      { label: 'Titre', value: `*${truncate(title, 40)}*` },
      { blank: true },
      { raw: `_${truncate(abstract || 'Aucune info trouvée pour « ' + q + ' ». Essayez un autre titre.', 120)}_` },
    ];
    if (data.AbstractURL) rows.push({ blank: true }, { label: 'Lien', value: truncate(data.AbstractURL, 40) });
    const out = box('🎬 *INFOS FILM*', rows);
    const img = data.Image ? 'https://duckduckgo.com' + data.Image : null;
    if (img) await conn.sendMessage(m.chat, { image: { url: img }, caption: out }).catch(() => reply(out));
    else reply(out);
  } catch (e) {
    reply('❌ Erreur: ' + e.message);
  }
});
