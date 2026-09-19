const { cmd } = require('../command.cjs');
const { boxWithFooter } = require('../lib/djousse-ui.cjs');
const axios = require('axios');

cmd({
  pattern: 'img',
  alias: ['googleimg', 'gimg'],
  desc: 'Google image search',
  category: 'search',
  filename: __filename,
}, async (conn, m, args, { reply }) => {
  const query = args.join(' ').trim();
  if (!query) {
    return conn.sendMessage(m.key.remoteJid, {
      text: boxWithFooter('🔍 Google Image', [{ raw: 'Provide a search query.\nUsage: .img <query>' }]),
    }, { quoted: m });
  }

  try {
    await m.react('🕐').catch(() => {});
    const { data } = await axios.get(`https://apis.davidcyriltech.my.id/googleimage?query=${encodeURIComponent(query)}`);

    if (!data || !data.result || !data.result.length) {
      await m.react('❌').catch(() => {});
      return conn.sendMessage(m.key.remoteJid, {
        text: boxWithFooter('🔍 Google Image', [{ raw: 'No images found for that query.' }]),
      }, { quoted: m });
    }

    const images = data.result;
    const shuffled = images.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(5, shuffled.length));

    for (const url of selected) {
      await conn.sendMessage(m.key.remoteJid, {
        image: { url },
        caption: boxWithFooter('🔍 Google Image', [
          { label: '🔎 Query', value: query },
        ]),
      }, { quoted: m });
    }

    await m.react('✅').catch(() => {});
  } catch (e) {
    await m.react('❌').catch(() => {});
    return conn.sendMessage(m.key.remoteJid, {
      text: boxWithFooter('🔍 Google Image', [{ raw: 'Failed to fetch images. Try again later.' }]),
    }, { quoted: m });
  }
});
