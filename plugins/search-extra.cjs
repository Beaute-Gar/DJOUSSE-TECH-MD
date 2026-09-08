const { cmd } = require('../command.cjs');
const { fetchJson, getBuffer } = require('../lib/functions.cjs');

async function searchImages(query, limit = 10) {
  try {
    const data = await fetchJson(`https://g4xxvapi2.moopa.workers.dev/image-search?q=${encodeURIComponent(query)}`);
    if (Array.isArray(data)) return data.slice(0, limit);
    if (data?.data && Array.isArray(data.data)) return data.data.slice(0, limit);
    if (data?.result && Array.isArray(data.result)) return data.result.slice(0, limit);
  } catch { }
  return [];
}

cmd({ pattern: 'img', desc: 'Rechercher des images', category: 'search', filename: __filename }, async (conn, m) => {
  const query = m.body.split(' ').slice(1).join(' ');
  if (!query) return m.reply('❌ Usage: .img <recherche>\nEx: .img chat mignon');
  m.reply('🔎 *Recherche d\'images...*');
  const imgs = await searchImages(query);
  if (!imgs.length) return m.reply('❌ Aucune image trouvée.');
  const url = imgs[0];
  await conn.sendMessage(m.chat, { image: { url }, caption: `🖼️ *Résultat pour:* ${query}\n\n> DJOUSSE TECH` }, { quoted: m });
});

cmd({ pattern: 'googleimage', desc: 'Rechercher des images Google', category: 'search', filename: __filename }, async (conn, m) => {
  const query = m.body.split(' ').slice(1).join(' ');
  if (!query) return m.reply('❌ Usage: .googleimage <recherche>');
  m.reply('🔎 *Recherche Google Images...*');
  const imgs = await searchImages(query, 5);
  if (!imgs.length) return m.reply('❌ Aucune image trouvée.');
  for (const url of imgs.slice(0, 3)) {
    await conn.sendMessage(m.chat, { image: { url }, caption: `🖼️ ${query}` }, { quoted: m });
  }
});

cmd({ pattern: 'wallpaper', desc: 'Télécharger un wallpaper', category: 'search', filename: __filename }, async (conn, m) => {
  const query = m.body.split(' ').slice(1).join(' ') || '4k';
  m.reply('🔎 *Recherche de wallpaper...*');
  const imgs = await searchImages(`${query} wallpaper 4k`, 5);
  if (!imgs.length) return m.reply('❌ Aucun wallpaper trouvé.');
  const url = imgs[Math.floor(Math.random() * imgs.length)];
  await conn.sendMessage(m.chat, { image: { url }, caption: `🖼️ *Wallpaper:* ${query}` }, { quoted: m });
});

cmd({ pattern: 'dog', desc: 'Photo aléatoire de chien', category: 'search', filename: __filename }, async (conn, m) => {
  const data = await fetchJson('https://random.dog/woof.json');
  const url = data?.url;
  if (!url) return m.reply('❌ Impossible de récupérer un chien.');
  await conn.sendMessage(m.chat, { image: { url }, caption: '🐶 *Woof!* Un chien pour toi !' }, { quoted: m });
});

cmd({ pattern: 'cat', desc: 'Photo aléatoire de chat', category: 'search', filename: __filename }, async (conn, m) => {
  const data = await fetchJson('https://cataas.com/cat?json=true');
  const id = data?._id;
  const url = id ? `https://cataas.com/cat/${id}` : 'https://cataas.com/cat';
  await conn.sendMessage(m.chat, { image: { url }, caption: '🐱 *Meow!* Un chat pour toi !' }, { quoted: m });
});

cmd({ pattern: 'ttsearch', desc: 'Rechercher des vidéos TikTok', category: 'search', filename: __filename }, async (conn, m) => {
  const query = m.body.split(' ').slice(1).join(' ');
  if (!query) return m.reply('❌ Usage: .ttsearch <recherche>');
  m.reply('🔎 *Recherche TikTok...*');
  const data = await fetchJson(`https://g4xxvapi2.moopa.workers.dev/ttsearch?q=${encodeURIComponent(query)}`);
  const results = data?.data || data?.result || [];
  if (!results.length) return m.reply('❌ Aucun résultat trouvé.');
  let txt = `🎵 *RÉSULTATS TIKTOK:* ${query}\n\n`;
  results.slice(0, 10).forEach((r, i) => {
    txt += `${i + 1}. *${r.title || r.desc || 'Vidéo'}*\n`;
    txt += `👤 ${r.author || '?'} | 🕒 ${r.duration || '?'}\n`;
    if (r.url) txt += `🔗 ${r.url}\n\n`;
  });
  m.reply(txt);
});
