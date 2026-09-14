const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const fetch = require('node-fetch');
const config = require('../../config');

module.exports = {
  name: 'attp',
  aliases: ['attp'],
  category: 'general',
  desc: 'Sticker avec texte animé',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return await ctx.reply('Écris le texte pour le sticker animé.\nEx: .attp Bonjour');
    }
    try {
      await ctx.react('✨');
      const url = `https://api.lolhuman.xyz/api/attp?text=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      const buffer = await res.buffer();
      const sticker = new Sticker(buffer, {
        pack: config.packname || config.botName,
        author: config.ownerName?.[0] || 'Owner',
        type: StickerTypes.FULL
      });
      await sock.sendMessage(ctx.from, { sticker: await sticker.toBuffer() });
    } catch (e) {
      await ctx.reply('Oups, j\'ai pas réussi à faire le sticker animé.');
    }
  }
};
