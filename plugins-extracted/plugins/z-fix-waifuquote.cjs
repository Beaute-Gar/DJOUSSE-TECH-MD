const { cmd } = require('../command.cjs');
const axios = require('axios');

const QUOTES = [
  '💭 « La force ne vient pas du corps, mais de la volonté de l\'âme. »',
  '💭 « Un véritable héros n\'est pas celui qui gagne, mais celui qui protège. »',
  '💭 « Le destin n\'est pas une question de chance, mais de choix. »',
  '💭 « Tant qu\'on vit, il y a de l\'espoir. »',
  '💭 « Les rêves sont la preuve que l\'impossible existe encore. »',
  '💭 « Ce qui ne te tue pas te rend plus fort. »',
  '💭 « La patience est l\'arme la plus puissante. »',
  '💭 « Un sourire peut changer une journée, une citation peut changer une vie. »',
];

cmd({ pattern: 'waifuquote', category: 'djousse', filename: __filename }, async (conn, m, commands, { q, reply }) => {
  try {
    const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    const r = await axios.get('https://api.waifu.pics/sfw/waifu', { timeout: 20000 });
    const img = r.data?.url;
    if (img) {
      await conn.sendMessage(m.chat, { image: { url: img }, caption: quote }).catch(() => reply(quote));
    } else {
      reply(quote);
    }
  } catch (e) {
    reply('❌ Erreur: ' + e.message);
  }
});
