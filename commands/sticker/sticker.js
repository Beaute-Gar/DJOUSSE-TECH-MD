const { cmd } = require('../command.cjs');
const { boxWithFooter } = require('../lib/djousse-ui.cjs');
const { Sticker } = require('wa-sticker-kit');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

cmd({
  pattern: 'sticker',
  alias: ['s', 'stiker', 'stk'],
  desc: 'Crée un sticker à partir d\'une image ou vidéo',
  category: 'sticker',
  filename: __filename,
}, async (conn, m, args, { reply, react }) => {
  try {
    // Récupérer le média (image ou vidéo)
    let media = null;
    if (m.quoted && m.quoted.message) {
      const quotedMsg = m.quoted.message;
      if (quotedMsg.imageMessage || quotedMsg.videoMessage) {
        media = await downloadMediaMessage(m.quoted);
      }
    } else if (m.message) {
      if (m.message.imageMessage || m.message.videoMessage) {
        media = await downloadMediaMessage(m);
      }
    }

    if (!media) {
      return reply(boxWithFooter('STICKER', [
        { raw: '❌ Envoyez une image ou une courte vidéo.' },
        { raw: 'Ou répondez à une image avec .sticker' },
      ]));
    }

    await react('⏳');

    // Options du sticker
    const packName = args[0] || 'DJOUSSE-TECH';
    const author = args[1] || 'Bot';

    const sticker = new Sticker(media, {
      pack: packName,
      author: author,
      type: 'full',
      quality: 70,
    });

    const stickerBuffer = await sticker.toBuffer();
    await conn.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m });
    await react('✅');
  } catch (err) {
    console.error('[STICKER]', err.message);
    await reply(boxWithFooter('STICKER', [{ raw: '❌ Erreur: ' + err.message }]));
    await react('❌');
  }
});
