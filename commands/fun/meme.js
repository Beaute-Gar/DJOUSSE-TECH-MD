const api = require('../../utils/api');

module.exports = {
  name: 'meme',
  aliases: ['meme'],
  category: 'fun',
  desc: 'Envoie un mème aléatoire',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    try {
      await ctx.react('🤣');
      const url = await api.getMeme();
      if (!url) return ctx.reply('Pas de mème dispo là...');
      await sock.sendMessage(ctx.from, { image: { url }, caption: 'Voilà un mème pour toi !' });
    } catch (e) {
      ctx.reply('Impossible de charger le mème...');
    }
  }
};
