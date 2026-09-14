const fetch = require('node-fetch');

module.exports = {
  name: 'hwaifu',
  aliases: ['hwaifu'],
  category: 'anime',
  desc: 'Image waifu NSFW',
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
      await sock.sendMessage(ctx.from, { image: { url: data.url }, caption: 'Waifu NSFW!' });
    } catch (e) {
      await ctx.reply('Oups, le serveur waifu est pas dispo.');
    }
  }
};
