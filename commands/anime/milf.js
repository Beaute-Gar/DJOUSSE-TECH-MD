const fetch = require('node-fetch');

module.exports = {
  name: 'milf',
  aliases: ['milf'],
  category: 'anime',
  desc: 'Image milf aléatoire',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: true,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    try {
      await ctx.react('🔥');
      const res = await fetch('https://api.waifu.pics/nsfw/waifu');
      const data = await res.json();
      await sock.sendMessage(ctx.from, { image: { url: data.url }, caption: 'Milf aléatoire!' });
    } catch (e) {
      await ctx.reply('Oups, le serveur est pas dispo.');
    }
  }
};
