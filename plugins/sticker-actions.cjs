const { cmd } = require('../command.cjs');
const axios = require('axios');
const actions = ['cry', 'kiss', 'kill', 'kick', 'hug', 'pat', 'lick', 'bite', 'yeet', 'bully', 'bonk', 'wink', 'poke', 'nom', 'slap', 'smile', 'wave', 'awoo', 'blush', 'smug', 'dance', 'happy', 'sad', 'cringe', 'cuddle', 'shinobu', 'handhold', 'glomp', 'highfive'];

for (const action of actions) {
  cmd({
    pattern: action,
    react: '🎭',
    desc: 'Sticker ' + action,
    category: 'fun',
    filename: __filename,
  }, async (conn, m, commands, { from, reply }) => {
    try {
      await m.react('🎭').catch(() => {});
      const { data } = await axios.get('https://api.waifu.pics/sfw/' + action);
      if (data && data.url) {
        conn.sendMessage(from, { image: { url: data.url }, caption: '🎭 *' + action.toUpperCase() + '*' }, { quoted: m });
      } else { reply('❌ Erreur.'); }
    } catch (error) { reply('❌ Erreur: ' + error.message); }
  });
}
