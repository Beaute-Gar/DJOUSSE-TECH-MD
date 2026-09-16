const axios = require('axios');
const { cmd } = require('../command.cjs');
const { box, truncate } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'quote',
  desc: 'Get a random quote from ZenQuotes',
  category: 'fun',
  react: '📜',
  filename: __filename,
  function: async (conn, m, commands, { reply }) => {
    try {
      const res = await axios.get('https://zenquotes.io/api/random');
      const data = res.data[0];
      await reply(box('📜 *CITATION*', [
        { label: '📝 Citation', value: truncate(data.q, 200) },
        { label: '✍️ Auteur', value: data.a },
      ]));
    } catch (err) {
      console.error('Quote Error:', err);
      await reply(box('📜 *CITATION*', [
        { raw: '❌ *Failed to fetch a quote.*' },
      ]));
    }
  },
});
