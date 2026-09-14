const api = require('../../utils/api');

module.exports = {
  name: 'ssweb',
  aliases: ['ssweb', 'ss'],
  category: 'general',
  desc: 'Capture d\'écran d\'un site web',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const url = args[0];
    if (!url) {
      return await ctx.reply('Envoie un lien de site web.\nEx: .ssweb https://google.com');
    }
    try {
      await ctx.react('📸');
      const imgUrl = await api.ssWeb(url);
      if (!imgUrl) {
        return await ctx.reply('J\'ai pas réussi à capturer le site.');
      }
      await sock.sendMessage(ctx.from, { image: { url: imgUrl }, caption: `Capture de ${url}` });
    } catch (e) {
      await ctx.reply('Oups, la capture a pas marché.');
    }
  }
};
