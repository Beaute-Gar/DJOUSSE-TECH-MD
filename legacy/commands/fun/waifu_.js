const { cmd } = require('../command.cjs');
const axios = require('axios');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');;

cmd({ pattern: 'animegirl', alias: ['waifu'], react: '💖', desc: 'Sends a random waifu', category: 'MATHTOOL', filename: __filename }, async (conn, m, commands, { from, reply }) => {
  try {
    const res = await axios.get('https://nekos.best/api/v2/waifu');
    const img = res.data.results?.[0]?.url;
    if (!img) throw new Error('No waifu image found in response');
    const caption = box('💖 *RANDOM WAIFU*', [
      { raw: '💘 Une waifu aléatoire rien que pour toi !' },
    ]);
    await conn.sendMessage(from, { image: { url: img }, caption }, { quoted: m });
  } catch (err) {
    console.error('❌ WAIFU Error:', err.response?.data || err.message);
    reply(boxWithFooter('💖 *RANDOM WAIFU*', [
      { raw: '❌ *Failed to fetch waifu. Please try again later.*' },
    ]));
  }
});
