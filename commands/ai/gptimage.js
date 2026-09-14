const api = require('../../utils/api');

module.exports = {
  name: 'gptimage',
  aliases: ['gptimage', 'aiimg'],
  category: 'ai',
  desc: 'Génère une image avec l\'IA',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const prompt = args.join(' ');
    if (!prompt) {
      return await ctx.reply('Décris l\'image que tu veux.\nEx: .gptimage un chat dans l\'espace');
    }
    try {
      await ctx.react('🎨');
      const url = await api.imageFromText(prompt);
      if (!url) {
        return await ctx.reply('J\'ai pas réussi à générer l\'image.');
      }
      await sock.sendMessage(ctx.from, { image: { url }, caption: `Image générée: ${prompt}` });
    } catch (e) {
      await ctx.reply('Oups, la génération a pas marché.');
    }
  }
};
