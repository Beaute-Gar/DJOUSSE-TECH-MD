const { cmd } = require('../command.cjs');
const { box, truncate } = require('../lib/djousse-ui.cjs');

/* Tourl.cjs — Convertir un fichier média en URL (upload vers catbox) */
const { upload } = require('../lib/catbox.cjs');

cmd({
  pattern: 'tourl',
  alias: ['touri', 'tourl'],
  react: '🔗',
  desc: 'Convertir un média en lien',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const target = m.quoted || m;
  const buffer = await target.download?.() || null;
  if (!buffer) return reply('❌ Envoie ou cite un média avec .tourl');

  try {
    await m.react('🕐').catch(() => {});
    const ext = target.mimetype?.includes('video') ? '.mp4'
      : target.mimetype?.includes('image') ? '.png'
      : target.mimetype?.includes('audio') ? '.mp3'
      : '.bin';
    const url = await upload(buffer, 'file' + ext);
    await conn.sendMessage(m.chat, { text: '🔗 *URL:* ' + url }, { quoted: m });
    await m.react('✅').catch(() => {});
  } catch (e) {
    await m.react('❌').catch(() => {});
    reply('❌ Erreur: ' + e.message);
  }
});
