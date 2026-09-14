const { writeExifImg } = require('../../utils/exif');
const config = require('../../config');

module.exports = {
  name: 'take',
  aliases: ['take', 'setpack'],
  category: 'general',
  desc: 'Change le nom du pack sur un sticker',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const stickerMsg = quoted?.stickerMessage;
    if (!stickerMsg) {
      return await ctx.reply('Réponds à un sticker pour changer le nom du pack.\nEx: .take MonPack');
    }
    const packname = args.join(' ') || config.packname || config.botName;
    try {
      await ctx.react('🏷️');
      const stream = await sock.downloadMediaMessage({ message: stickerMsg });
      const buffer = Buffer.from(stream);
      const newSticker = await writeExifImg(buffer, {
        packname,
        author: config.ownerName?.[0] || 'Owner'
      });
      await sock.sendMessage(ctx.from, { sticker: newSticker });
    } catch (e) {
      await ctx.reply('Oups, j\'ai pas réussi à changer le nom du pack.');
    }
  }
};
