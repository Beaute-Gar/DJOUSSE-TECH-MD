const api = require('../../utils/api');

module.exports = {
  name: 'translate',
  aliases: ['translate', 'traduire'],
  category: 'utility',
  desc: 'Traduit du texte',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    if (args.length < 2) return ctx.reply('Utilisation: .translate <langue> <texte>\nExemple: .translate en bonjour');
    const lang = args[0].toLowerCase();
    const text = args.slice(1).join(' ');
    try {
      await ctx.react('🌐');
      const result = await api.translateText(text, lang);
      ctx.reply(`Traduction (${lang}) :\n${result}`);
    } catch (e) {
      ctx.reply('Erreur lors de la traduction...');
    }
  }
};
