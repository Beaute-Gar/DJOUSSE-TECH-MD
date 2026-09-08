const { cmd } = require('../command.cjs');
const { fetchJson } = require('../lib/functions.cjs');
const { box } = require('../lib/djousse-ui.cjs');

const NEKO_TYPES = ['waifu', 'neko', 'shinobu', 'megumin', 'awoo', 'husbando'];

function animeCaption(title, extra) {
  const rows = [];
  if (extra) rows.push({ label: 'Info', value: extra });
  return box(title, rows);
}

cmd({ pattern: 'animewallpaper', desc: 'Wallpaper anime aléatoire', category: 'anime', filename: __filename }, async (conn, m) => {
  const data = await fetchJson('https://api.waifu.pics/sfw/waifu');
  if (!data?.url) return m.reply('❌ Aucun wallpaper trouvé.');
  const caption = animeCaption('🖼️ *WALLPAPER ANIME*', '*Wallpaper aléatoire*');
  await conn.sendMessage(m.chat, { image: { url: data.url }, caption }, { quoted: m });
});

cmd({ pattern: 'animeimg', desc: 'Image anime aléatoire', category: 'anime', filename: __filename }, async (conn, m) => {
  const data = await fetchJson('https://api.waifu.pics/sfw/waifu');
  if (!data?.url) return m.reply('❌ Aucune image trouvée.');
  const caption = box('🎌 *IMAGE ANIME*', [
    { label: 'Type', value: '*waifu*' },
    { label: 'Source', value: 'api.waifu.pics' },
  ]);
  await conn.sendMessage(m.chat, { image: { url: data.url }, caption }, { quoted: m });
});

cmd({ pattern: 'animerand', desc: 'Image anime random (waifu/neko/...)', category: 'anime', filename: __filename }, async (conn, m) => {
  const type = NEKO_TYPES[Math.floor(Math.random() * NEKO_TYPES.length)];
  const data = await fetchJson(`https://api.waifu.pics/sfw/${type}`);
  if (!data?.url) return m.reply('❌ Aucune image trouvée.');
  const caption = animeCaption('🎌 *IMAGE ANIME*', `Type : *${type}*`);
  await conn.sendMessage(m.chat, { image: { url: data.url }, caption }, { quoted: m });
});

cmd({ pattern: 'megumin', desc: 'Image de Megumin', category: 'anime', filename: __filename }, async (conn, m) => {
  const data = await fetchJson('https://api.waifu.pics/sfw/megumin');
  if (!data?.url) return m.reply('❌ Aucune image trouvée.');
  const caption = animeCaption('🧙‍♀️ *MEGUMIN!*', '*Explosion!! 💥*');
  await conn.sendMessage(m.chat, { image: { url: data.url }, caption }, { quoted: m });
});

cmd({ pattern: 'maid', desc: 'Image de maid', category: 'anime', filename: __filename }, async (conn, m) => {
  const data = await fetchJson('https://api.waifu.pics/sfw/maid');
  if (!data?.url) return m.reply('❌ Aucune image trouvée.');
  const caption = animeCaption('👩‍🍳 *MAID*', '*Maid desu!*');
  await conn.sendMessage(m.chat, { image: { url: data.url }, caption }, { quoted: m });
});

cmd({ pattern: 'awoo', desc: 'Image awoo', category: 'anime', filename: __filename }, async (conn, m) => {
  const data = await fetchJson('https://api.waifu.pics/sfw/awoo');
  if (!data?.url) return m.reply('❌ Aucune image trouvée.');
  const caption = animeCaption('🐺 *AWOO*', '*Awooo~!*');
  await conn.sendMessage(m.chat, { image: { url: data.url }, caption }, { quoted: m });
});

cmd({ pattern: 'waifu2', desc: 'Image waifu aléatoire', category: 'anime', filename: __filename }, async (conn, m) => {
  const data = await fetchJson('https://api.waifu.pics/sfw/waifu');
  if (!data?.url) return m.reply('❌ Aucune image trouvée.');
  const caption = animeCaption('💕 *WAIFU*', '*Waifu pour toi!*');
  await conn.sendMessage(m.chat, { image: { url: data.url }, caption }, { quoted: m });
});

cmd({ pattern: 'loli', desc: 'Image anime (émoji)', category: 'anime', filename: __filename }, async (conn, m) => {
  const data = await fetchJson('https://api.waifu.pics/sfw/waifu');
  if (!data?.url) return m.reply('❌ Aucune image trouvée.');
  const caption = animeCaption('🎀 *KAWAII*', '*Kawaii~*');
  await conn.sendMessage(m.chat, { image: { url: data.url }, caption }, { quoted: m });
});
