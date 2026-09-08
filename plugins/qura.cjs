const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'quranvid',
  alias: ['qvid', 'quranvideo'],
  react: '🌙',
  desc: 'Vidéo Quran aléatoire',
  category: 'islam',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  try {
    await conn.sendMessage(from, {
      video: { url: 'https://bk9.fun/Islam/quranvid' },
      caption: box('🌙 *QURAN VIDEO*', [
        { blank: true }, { raw: '🎧 *Écoute et médite les versets divins*' },
        { blank: true }, { raw: '_"Un cœur sain commence par des versets divins."_ ' },
        { blank: true }, { raw: '🕌 DJOUSSE-TECH-MD Exclusive' },
      ]),
    }, { quoted: m });
  } catch (e) { reply('❌ Erreur: ' + e.message); }
});

cmd({
  pattern: 'quraimage',
  alias: ['qimg'],
  react: '🕌',
  desc: 'Image Quran aléatoire',
  category: 'islam',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  try {
    await conn.sendMessage(from, {
      image: { url: 'https://bk9.fun/Islam/din' },
      caption: box('🕌 *QURAN IMAGE*', [
        { blank: true }, { raw: '🖼️ *Image inspirante islamique*' },
        { blank: true }, { raw: '_"La foi ne se voit pas, elle se ressent."_ ' },
        { blank: true }, { raw: '✨ DJOUSSE-TECH-MD' },
      ]),
    }, { quoted: m });
  } catch (e) { reply('❌ Erreur: ' + e.message); }
});
