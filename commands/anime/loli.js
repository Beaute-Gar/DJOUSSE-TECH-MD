const fetch = require('node-fetch');

module.exports = {
  name: 'loli',
  aliases: ['loli'],
  category: 'anime',
  desc: 'Image loli aléatoire',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    try {
      await ctx.react('✨');
      const res = await fetch('https://api.waifu.pics/sfw/waifu');
      const data = await res.json();
      await sock.sendMessage(ctx.from, { image: { url: data.url }, caption: 'Loli aléatoire!' });
    } catch (e) {
      await ctx.reply('Oups, le serveur est pas dispo.');
    }
  }
};
