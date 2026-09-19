const { cmd } = require('../command.cjs');
const { box, boxWithFooter, truncate } = require('../lib/djousse-ui.cjs');

/* memes.cjs — Blagues et memes aléatoires */

cmd({
  pattern: 'joke',
  alias: ['blague'],
  react: '😂',
  desc: 'Blague aléatoire en anglais',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  try {
    await m.react('🕐').catch(() => {});
    const res = await fetch('https://official-joke-api.appspot.com/random_joke');
    const joke = await res.json();
    const text = box('😂 *BLAGUE*', [
      { raw: joke.setup },
      { blank: true },
      { raw: '*' + joke.punchline + '*' },
    ]);
    await conn.sendMessage(from, { text }, { quoted: m });
    await m.react('😂').catch(() => {});
  } catch (e) {
    await m.react('❌').catch(() => {});
    reply(boxWithFooter('ERREUR', [{ raw: '❌ Impossible de récupérer une blague.' }]));
  }
});

cmd({
  pattern: 'memes',
  alias: ['meme'],
  react: '🤣',
  desc: 'Meme aléatoire',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  try {
    await m.react('🕐').catch(() => {});
    const res = await fetch('https://meme-api.com/gimme');
    const meme = await res.json();
    if (!meme.url) return reply(boxWithFooter('ERREUR', [{ raw: '❌ Aucun meme trouvé.' }]));
    await conn.sendMessage(from, {
      image: { url: meme.url },
      caption: '🤣 *' + (meme.title || 'Meme') + '*\n_' + (meme.subreddit || '') + '_',
    }, { quoted: m });
    await m.react('🤣').catch(() => {});
  } catch (e) {
    await m.react('❌').catch(() => {});
    reply(boxWithFooter('ERREUR', [{ raw: '❌ Impossible de récupérer un meme.' }]));
  }
});

cmd({
  pattern: 'roast',
  react: '🔥',
  desc: 'Roast aléatoire',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  const roasts = [
    'Tu es la preuve que même la nature fait des erreurs.',
    'Si tu étais une pizza, tu serais la pizza hawaïenne — personne ne t\'a demandé.',
    'Ton reflet dans le miroir baisse les yeux.',
    'Tu es le type de personne qu\'on muterait dans un jeu.',
    'Même Google ne sait pas ce que tu fais de ta vie.',
    'Tu es l\'argument le plus fort contre l\'évolution.',
    'Si la stupidité était un sport, tu serais olympique.',
    'Ton cerveau est en mode avion.',
  ];
  const roast = roasts[Math.floor(Math.random() * roasts.length)];
  await conn.sendMessage(from, { text: '🔥 *ROAST:* ' + roast }, { quoted: m });
});


