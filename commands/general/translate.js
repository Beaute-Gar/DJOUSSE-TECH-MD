const api = require('../../utils/api');

module.exports = {
  name: 'translate',
  aliases: ['translate', 'tr'],
  category: 'general',
  desc: 'Traduit du texte',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return await ctx.reply('Écris le texte à traduire.\nEx: .tr hello world');
    }
    try {
      await ctx.react('🌐');
      const result = await api.translateText(text);
      await ctx.reply(`*Traduction:*\n${result}`);
    } catch (e) {
      await ctx.reply('Oups, la traduction a pas marché.');
    }
  }
};
