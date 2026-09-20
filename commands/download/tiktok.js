const { cmd } = require('../command.cjs');
const { boxWithFooter } = require('../lib/djousse-ui.cjs');
const { lmna } = require('@lmna22/aio-downloader');

cmd({
  pattern: 'tiktok',
  alias: ['tt', 'ttdl'],
  desc: 'Télécharge une vidéo TikTok',
  category: 'download',
  filename: __filename,
}, async (conn, m, args, { reply, react, q }) => {
  if (!q || !q.startsWith('http')) {
    return reply(boxWithFooter('TIKTOK', [
      { raw: '❌ Envoyez un lien TikTok.' },
      { raw: 'Ex: .tiktok https://vm.tiktok.com/xxx' },
    ]));
  }
  try {
    await react('⬇️');
    const result = await lmna.tiktok(q);
    if (!result || !result.status) {
      return reply(boxWithFooter('TIKTOK', [{ raw: '❌ Échec du téléchargement.' }]));
    }
    const data = result.data || result;
    const videoUrl = data.video || data.result || data.download || (data.links && data.links[0] && data.links[0].url);
    if (!videoUrl) {
      return reply(boxWithFooter('TIKTOK', [{ raw: '❌ Aucune vidéo trouvée.' }]));
    }
    await conn.sendMessage(m.chat, {
      video: { url: videoUrl },
      caption: boxWithFooter('TIKTOK', [
        { label: '📱 Source', value: 'TikTok' },
      ]),
    }, { quoted: m });
    await react('✅');
  } catch (err) {
    console.error('[TIKTOK]', err.message);
    await reply(boxWithFooter('TIKTOK', [{ raw: '❌ Erreur: ' + err.message }]));
    await react('❌');
  }
});
