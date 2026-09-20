const { cmd } = require('../command.cjs');
const { boxWithFooter } = require('../lib/djousse-ui.cjs');
const { lmna } = require('@lmna22/aio-downloader');

cmd({
  pattern: 'instagram',
  alias: ['ig', 'igdl', 'insta'],
  desc: 'Télécharge un média Instagram',
  category: 'download',
  filename: __filename,
}, async (conn, m, args, { reply, react, q }) => {
  if (!q || !q.startsWith('http')) {
    return reply(boxWithFooter('INSTAGRAM', [
      { raw: '❌ Envoyez un lien Instagram.' },
      { raw: 'Ex: .instagram https://www.instagram.com/p/xxx' },
    ]));
  }
  try {
    await react('⬇️');
    const result = await lmna.instagram(q);
    if (!result || !result.status) {
      return reply(boxWithFooter('INSTAGRAM', [{ raw: '❌ Échec du téléchargement.' }]));
    }
    const data = result.data || result;
    const media = data.result || data.url || data.download || data.media;
    if (!media) {
      return reply(boxWithFooter('INSTAGRAM', [{ raw: '❌ Aucun média trouvé.' }]));
    }
    // Si c'est un tableau (carrousel), envoyer le premier
    const url = Array.isArray(media) ? media[0] : media;
    const isVideo = data.type === 'video' || url.includes('.mp4');
    if (isVideo) {
      await conn.sendMessage(m.chat, {
        video: { url },
        caption: boxWithFooter('INSTAGRAM', [{ label: '📸 Source', value: 'Instagram' }]),
      }, { quoted: m });
    } else {
      await conn.sendMessage(m.chat, {
        image: { url },
        caption: boxWithFooter('INSTAGRAM', [{ label: '📸 Source', value: 'Instagram' }]),
      }, { quoted: m });
    }
    await react('✅');
  } catch (err) {
    console.error('[INSTAGRAM]', err.message);
    await reply(boxWithFooter('INSTAGRAM', [{ raw: '❌ Erreur: ' + err.message }]));
    await react('❌');
  }
});
