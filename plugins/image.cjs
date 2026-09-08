const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

/* image.cjs — Recherche d'images via API publique */

cmd({
  pattern: 'image',
  alias: ['img', 'gimage'],
  react: '🖼️',
  desc: 'Rechercher des images sur le web',
  category: 'search',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!q) return reply(box('🖼️ *RECHERCHE IMAGE*', [{ label: 'Utilisation', value: '.image <terme>' }]));
  try {
    await m.react('🕐').catch(() => {});
    const apiKey = process.env.NEXORACLE_API_KEY || 'free_key@maher_apis';
    const res = await fetch('https://api.nexoracle.com/search/google-image?apikey=' + apiKey + '&q=' + encodeURIComponent(q));
    const data = await res.json();

    if (!data.result || !data.result.length) {
      await m.react('❌').catch(() => {});
      return reply('❌ Aucune image trouvée.');
    }

    const images = data.result.slice(0, 5);
    for (let i = 0; i < images.length; i++) {
      await new Promise(r => setTimeout(r, 500));
      await conn.sendMessage(m.chat, { image: { url: images[i] }, caption: '' }, { quoted: m });
    }
    await m.react('✅').catch(() => {});
  } catch (e) {
    await m.react('❌').catch(() => {});
    reply('❌ Erreur: ' + e.message);
  }
});
