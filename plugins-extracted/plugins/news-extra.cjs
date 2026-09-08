const { cmd } = require('../command.cjs');
const { fetchJson } = require('../lib/functions.cjs');
const { box, truncate } = require('../lib/djousse-ui.cjs');

const NEWS_SOURCES = {
  bbcnews: 'https://feeds.bbci.co.uk/news/world/rss.xml',
  worldnews: 'https://feeds.bbci.co.uk/news/world/rss.xml',
  newsfirst: 'https://www.newsfirst.lk/feed/',
  lankadeepa: 'https://www.lankadeepa.lk/rss/',
  derana: 'https://www.derana.lk/feed/',
};

const NEWS_TITLES = {
  bbcnews: '📰 *BBC NEWS*',
  worldnews: '🌍 *WORLD NEWS*',
  newsfirst: '📰 *NEWS FIRST*',
  lankadeepa: '📰 *LANKADEEPA*',
  derana: '📰 *DERANA*',
  intlnews: '🌐 *NEWS INTERNATIONALES*',
  sinhalanda: '📰 *SINHALANDA*',
};

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const title = (item.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || '';
    const link = (item.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1] || '';
    const pubDate = (item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
    items.push({ title: title.replace(/<!\[CDATA\[|\]\]>/g, '').trim(), link, pubDate });
    if (items.length >= 6) break;
  }
  return items;
}

async function getNews(url) {
  const xml = await Promise.race([
    fetchJson(url, { responseType: 'text' }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Source actualités indisponible')), 8000)),
  ]);
  if (typeof xml !== 'string') return [];
  return parseRSS(xml);
}

function newsRows(items) {
  const rows = [];
  items.forEach((it, i) => {
    rows.push({ raw: `*${i + 1}.* ${truncate(it.title, 80)}` });
    if (it.pubDate) rows.push({ raw: `┃ 🕒 ${truncate(it.pubDate.slice(5, 16).replace(' ', ' · '), 25)}` });
    if (it.link) rows.push({ raw: `┃ 🔗 ${truncate(it.link, 40)}` });
    rows.push({ blank: true });
  });
  return rows;
}

function buildNewsReply(key, items) {
  return box(NEWS_TITLES[key] || '📰 *ACTUALITÉS*', [
    { raw: `📊 *${items.length} articles* récents` },
    { blank: true },
    ...newsRows(items),
    { raw: '💡 Envoie `.news [source]` pour une autre source' },
  ]);
}

const NEWS_CMDS = Object.keys(NEWS_SOURCES);
for (const key of NEWS_CMDS) {
  const aliases = key === 'worldnews' ? 'worldnews|wnews' : key;
  cmd({ pattern: aliases, desc: `Dernières actualités ${key}`, category: 'news', filename: __filename }, async (conn, m) => {
    await m.reply('⏳ *Chargement des actualités...*');
    try {
      const items = await getNews(NEWS_SOURCES[key]);
      if (!items.length) return m.reply('❌ Aucune actualité trouvée.');
      return m.reply(buildNewsReply(key, items));
    } catch (error) { return m.reply(`❌ Source ${key} indisponible actuellement.`); }
  });
}

cmd({ pattern: 'news', desc: 'Dernières actualités', category: 'news', filename: __filename }, async (conn, m) => {
  m.reply('⏳ *Chargement des actualités...*');
  const items = await getNews(NEWS_SOURCES.worldnews);
  if (!items.length) return m.reply('❌ Aucune actualité trouvée.');
  const rows = [{ label: 'Catégorie', value: '*Monde*' }, { blank: true }];
  items.slice(0, 3).forEach((it, i) => {
    rows.push({ raw: `*${i + 1}.* ${truncate(it.title, 80)}` });
    if (it.pubDate) rows.push({ raw: `┃ 🕒 ${truncate(it.pubDate.slice(5, 16).replace(' ', ' · '), 25)}` });
    rows.push({ blank: true });
  });
  rows.push({ raw: '💡 Sources : `.bbcnews`, `.worldnews`, `.newsfirst`' });
  m.reply(box('📰 *ACTUALITÉS*', rows));
});

cmd({ pattern: 'intlnews', desc: 'Actualités internationales', category: 'news', filename: __filename }, async (conn, m) => {
  m.reply('⏳ *Chargement des news internationales...*');
  const items = await getNews(NEWS_SOURCES.worldnews);
  if (!items.length) return m.reply('❌ Aucune actualité trouvée.');
  m.reply(buildNewsReply('intlnews', items));
});

cmd({ pattern: 'sinhalanda', desc: 'Actualités Sinhalanda', category: 'news', filename: __filename }, async (conn, m) => {
  m.reply('⏳ *Chargement Sinhalanda...*');
  const items = await getNews(NEWS_SOURCES.derana);
  if (!items.length) return m.reply('❌ Aucune actualité trouvée.');
  m.reply(buildNewsReply('sinhalanda', items));
});
