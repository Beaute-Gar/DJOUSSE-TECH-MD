const fetch = require('node-fetch');

module.exports = {
  name: 'hneko',
  aliases: ['hneko'],
  category: 'anime',
  desc: 'Image neko NSFW',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: true,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    try {
      await ctx.react('🔥');
      const res = await fetch('https://nekos.life/api/v2/img/neko');
      const data = await res.json();
      await sock.sendMessage(ctx.from, { image: { url: data.message || data.url }, caption: 'Neko NSFW!' });
    } catch (e) {
      await ctx.reply('Oups, le serveur neko est pas dispo.');
    }
  }
};
