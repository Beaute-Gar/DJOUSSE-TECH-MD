const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const fetch = require('node-fetch');

/* anime.cjs — Commandes anime : waifu, neko, husbando, kitsune, hentai,
   anime search, manga search, anime fact, anime quote, anime quiz, aniroll */

const waifuEndpoints = {
  waifu: 'https://api.waifu.pics/sfw/waifu',
  husbando: 'https://api.waifu.pics/sfw/husbando',
  neko: 'https://api.waifu.pics/sfw/neko',
  animegirl: 'https://api.waifu.pics/sfw/waifu',
  animeboy: 'https://api.waifu.pics/sfw/waifu',
  kitsune: 'https://api.waifu.pics/sfw/kitsune',
  hentaigif: 'https://api.waifu.pics/nsfw/neko',
  hentai: 'https://api.waifu.pics/nsfw/neko',
};

async function getJSON(url) {
  try {
    const res = await fetch(url);
    return res.ok ? await res.json() : null;
  } catch (e) {
    console.error('API Fetch error:', e);
    return null;
  }
}

for (const [cmdName, url] of Object.entries(waifuEndpoints)) {
  cmd({
    pattern: cmdName,
    react: '✨',
    desc: 'Envoie un random ' + cmdName,
    category: 'anime',
    filename: __filename,
  }, async (conn, m, commands, { from, reply }) => {
    const data = await getJSON(url);
    if (!data || !data.url) return reply('❌ Impossible de récupérer l\'image.');
    await conn.sendMessage(from, { image: { url: data.url }, caption: '✨ *' + cmdName + '*' }, { quoted: m });
  });
}

cmd({
  pattern: 'anime',
  react: '🎬',
  desc: 'Rechercher une info anime',
  category: 'anime',
  filename: __filename,
}, async (conn, m, commands, { from, q, reply }) => {
  if (!q) return reply('❓ Fournis un nom d\'anime. Exemple: .anime Naruto');
  const data = await getJSON('https://api.jikan.moe/v4/anime?q=' + encodeURIComponent(q) + '&limit=1');
  if (!data || !data.data || !data.data.length) return reply('❌ Aucun anime trouvé.');
  const a = data.data[0];
  const text = box('🎬 *ANIME INFO*', [
    { label: 'Titre', value: a.title },
    { label: 'Score', value: String(a.score || '?') },
    { label: 'Épisodes', value: String(a.episodes || '?') },
    { label: 'Genres', value: (a.genres || []).map(g => g.name).join(', ') },
    { raw: '\n' + (a.synopsis || '').slice(0, 500) },
  ]);
  await conn.sendMessage(from, { text }, { quoted: m });
});

cmd({
  pattern: 'manga',
  react: '📚',
  desc: 'Rechercher un manga',
  category: 'anime',
  filename: __filename,
}, async (conn, m, commands, { from, q, reply }) => {
  if (!q) return reply('❓ Fournis un nom de manga. Exemple: .manga One Piece');
  const data = await getJSON('https://api.jikan.moe/v4/manga?q=' + encodeURIComponent(q) + '&limit=1');
  if (!data || !data.data || !data.data.length) return reply('❌ Aucun manga trouvé.');
  const a = data.data[0];
  const text = box('📚 *MANGA INFO*', [
    { label: 'Titre', value: a.title },
    { label: 'Score', value: String(a.score || '?') },
    { label: 'Chapitres', value: String(a.chapters || '?') },
    { label: 'Genres', value: (a.genres || []).map(g => g.name).join(', ') },
    { raw: '\n' + (a.synopsis || '').slice(0, 500) },
  ]);
  await conn.sendMessage(from, { text }, { quoted: m });
});

cmd({
  pattern: 'animefact',
  react: '💡',
  desc: 'Fun fact anime aléatoire',
  category: 'anime',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  const data = await getJSON('https://nekos.life/api/v2/facts');
  if (!data || !data.fact) return reply('❌ Impossible de récupérer un fait.');
  await conn.sendMessage(from, { text: '💡 *Fun Fact:* ' + data.fact }, { quoted: m });
});

cmd({
  pattern: 'animequote',
  react: '💬',
  desc: 'Citation anime aléatoire',
  category: 'anime',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  const data = await getJSON('https://animechan.io/api/v1/quotes/random');
  if (!data || !data.data) return reply('❌ Impossible de récupérer une citation.');
  const q = data.data;
  const text = '💬 *"' + q.content + '"*\n— ' + q.character + ' (' + q.anime + ')';
  await conn.sendMessage(from, { text }, { quoted: m });
});

const animeQuizQuestions = [
  { q: 'Quel est le vrai nom de Luffy dans One Piece ?', a: 'Monkey D. Luffy' },
  { q: 'Qui est le Hokage dans Naruto Shippuden ?', a: 'Plusieurs réponses possibles' },
  { q: 'Dans quel anime on trouve des Titans ?', a: 'Attack on Titan (Shingeki no Kyojin)' },
  { q: 'Qui est le Saiyan le plus puissant dans DBZ ?', a: 'Goku (en général)' },
  { q: 'Dans quel anime Kakashi est-il un personnage principal ?', a: 'Naruto' },
];

cmd({
  pattern: 'animequiz',
  react: '❓',
  desc: 'Quiz anime aléatoire',
  category: 'anime',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  const q = animeQuizQuestions[Math.floor(Math.random() * animeQuizQuestions.length)];
  const text = '❓ *Quiz Anime:*\n' + q.q + '\n\n_Anponse: ' + q.a + '_';
  await conn.sendMessage(from, { text }, { quoted: m });
});

cmd({
  pattern: 'anigame',
  react: '🎮',
  desc: 'Jeu anime aléatoire',
  category: 'anime',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  const games = [
    'Devine le personnage à partir de la description !',
    'Quel anime a cette scène ?',
    'Quiz sur les-opening anime !',
  ];
  const game = games[Math.floor(Math.random() * games.length)];
  await conn.sendMessage(from, { text: '🎮 *AniGame:* ' + game }, { quoted: m });
});

cmd({
  pattern: 'aniroll',
  react: '🎥',
  desc: 'Clip aléatoire d\'anime',
  category: 'anime',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  const clips = [
    'https://media.tenor.com/videos/one-piece-luffy-gear-5.mp4',
    'https://media.tenor.com/videos/naruto-rasengan.mp4',
    'https://media.tenor.com/videos/attack-on-titan.mp4',
  ];
  const clip = clips[Math.floor(Math.random() * clips.length)];
  await conn.sendMessage(from, { video: { url: clip }, caption: '🎥 *AniRoll*' }, { quoted: m });
});
