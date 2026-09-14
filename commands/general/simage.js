const api = require('../../utils/api');

module.exports = {
  name: 'simage',
  aliases: ['simage', 'img'],
  category: 'general',
  desc: 'Recherche une image',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const prompt = args.join(' ');
    if (!prompt) {
      return await ctx.reply('Écris ce que tu veux chercher.\nEx: .simage paysage montagne');
    }
    try {
      await ctx.react('🔍');
      const url = await api.imageFromText(prompt);
      if (!url) {
        return await ctx.reply('J\'ai pas trouvé d\'image pour ça.');
      }
      await sock.sendMessage(ctx.from, { image: { url }, caption: `Image pour: ${prompt}` });
    } catch (e) {
      await ctx.reply('Oups, la recherche a pas marché.');
    }
  }
};
