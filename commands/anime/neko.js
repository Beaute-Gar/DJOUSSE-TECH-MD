const fetch = require('node-fetch');

module.exports = {
  name: 'neko',
  aliases: ['neko'],
  category: 'anime',
  desc: 'Image neko aléatoire',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    try {
      await ctx.react('🐱');
      const res = await fetch('https://nekos.life/api/v2/img/neko');
      const data = await res.json();
      await sock.sendMessage(ctx.from, { image: { url: data.message || data.url }, caption: 'Neko aléatoire!' });
    } catch (e) {
      await ctx.reply('Oups, le serveur neko est pas dispo.');
    }
  }
};
