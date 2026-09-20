const { cmd } = require('../command.cjs');
const { boxWithFooter } = require('../lib/djousse-ui.cjs');
const { lmna } = require('@lmna22/aio-downloader');

cmd({
  pattern: 'song',
  alias: ['youtube', 'ytmp3', 'ytaudio'],
  desc: 'Télécharge une audio YouTube',
  category: 'download',
  filename: __filename,
}, async (conn, m, args, { reply, react, q }) => {
  if (!q) return reply(boxWithFooter('YOUTUBE', [
    { raw: '❌ Envoyez un lien YouTube ou un mot-clé.' },
    { raw: 'Ex: .song https://youtu.be/xxx' },
  ]));
  try {
    await react('⬇️');
    const url = q.startsWith('http') ? q : q;
    const result = await lmna.youtube(url, '128'); // 128kbps audio
    if (!result || !result.status) {
      return reply(boxWithFooter('YOUTUBE', [{ raw: '❌ Échec du téléchargement.' }]));
    }
    const data = result.data || result;
    await conn.sendMessage(m.chat, {
      audio: { url: data.result || data.url || data.download },
      mimetype: 'audio/mpeg',
      ptt: false,
    }, { quoted: m });
    await reply(boxWithFooter('YOUTUBE', [
      { label: '🎵 Titre', value: data.title || 'Audio YouTube' },
    ]));
    await react('✅');
  } catch (err) {
    console.error('[YOUTUBE]', err.message);
    await reply(boxWithFooter('YOUTUBE', [{ raw: '❌ Erreur: ' + err.message }]));
    await react('❌');
  }
});

cmd({
  pattern: 'video',
  alias: ['ytvideo', 'ytmp4'],
  desc: 'Télécharge une vidéo YouTube',
  category: 'download',
  filename: __filename,
}, async (conn, m, args, { reply, react, q }) => {
  if (!q) return reply(boxWithFooter('YOUTUBE', [
    { raw: '❌ Envoyez un lien YouTube ou un mot-clé.' },
    { raw: 'Ex: .video https://youtu.be/xxx' },
  ]));
  try {
    await react('⬇️');
    const result = await lmna.youtube(q, '720'); // 720p
    if (!result || !result.status) {
      return reply(boxWithFooter('YOUTUBE', [{ raw: '❌ Échec du téléchargement.' }]));
    }
    const data = result.data || result;
    await conn.sendMessage(m.chat, {
      video: { url: data.result || data.url || data.download },
      caption: boxWithFooter('YOUTUBE', [
        { label: '🎬 Titre', value: data.title || 'Vidéo YouTube' },
      ]),
    }, { quoted: m });
    await react('✅');
  } catch (err) {
    console.error('[YOUTUBE]', err.message);
    await reply(boxWithFooter('YOUTUBE', [{ raw: '❌ Erreur: ' + err.message }]));
    await react('❌');
  }
});
