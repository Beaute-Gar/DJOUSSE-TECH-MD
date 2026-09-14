const { imageToSticker } = require('../../utils/stickerConverter');
const { writeExifImg } = require('../../utils/exif');
const config = require('../../config');

module.exports = {
  name: 'sticker',
  aliases: ['sticker', 's', 'stiker'],
  category: 'general',
  desc: 'Convertit une image en sticker',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const imageMsg = quoted?.imageMessage || msg.message?.imageMessage;
    if (!imageMsg) {
      return await ctx.reply('Envoie ou réponds à une image pour créer un sticker.');
    }
    try {
      await ctx.react('⏳');
      const stream = await sock.downloadMediaMessage({ message: imageMsg });
      const buffer = Buffer.from(stream);
      const webpBuffer = await imageToSticker(buffer);
      const stickerBuffer = await writeExifImg(webpBuffer, {
        packname: config.packname || config.botName,
        author: config.ownerName?.[0] || 'Owner'
      });
      await sock.sendMessage(ctx.from, { sticker: stickerBuffer });
    } catch (e) {
      await ctx.reply('Oups, j\'ai pas réussi à faire le sticker.');
    }
  }
};
