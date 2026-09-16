const { cmd } = require('../command.cjs');
const { fetchJson } = require('../lib/functions.cjs');
const { box, truncate } = require('../lib/djousse-ui.cjs');
const cheerio = require('cheerio');

cmd({ pattern: 'google', desc: 'Recherche Google (résultats texte)', category: 'search', filename: __filename }, async (conn, m) => {
  const query = m.body.split(' ').slice(1).join(' ');
  if (!query) return m.reply(box('🔍 *RECHERCHE*', [
    { raw: 'Utilisation :' },
    { raw: '.google <recherche>' },
    { blank: true },
    { raw: 'Exemple :' },
    { raw: '.google DJOUSSE TECH' },
  ]));
  m.reply('🔎 *Recherche Google...*');
  try {
    const res = await fetchJson(`https://www.google.com/search?q=${encodeURIComponent(query)}&num=10`);
    if (typeof res === 'string') {
      const $ = cheerio.load(res);
      const results = [];
      $('div.g').each((i, el) => {
        const t = $(el).find('h3').text().trim();
        const l = $(el).find('a').attr('href') || '';
        const s = $(el).find('.VwiC3b').text().trim() || $(el).find('div[data-sncf]').text().trim();
        if (t) results.push({ title: t, link: l, snippet: s });
      });
      if (!results.length) return m.reply('❌ Aucun résultat trouvé.');
      const rows = [{ label: 'Recherche', value: `*${truncate(query, 40)}*` }, { blank: true }];
      results.slice(0, 3).forEach((r, i) => {
        rows.push({ raw: `*${i + 1}.* ${truncate(r.title, 50)}` });
        rows.push({ raw: `↳ ${truncate(r.snippet, 80)}` });
        rows.push({ blank: true });
      });
      m.reply(box('🔍 *RÉSULTATS GOOGLE*', rows));
    } else {
      m.reply('❌ Format de résultat inattendu.');
    }
  } catch (e) {
    m.reply('❌ Erreur: ' + e.message);
  }
});
