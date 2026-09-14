const fetch = require('node-fetch');

module.exports = {
  name: 'konachan',
  aliases: ['konachan'],
  category: 'anime',
  desc: 'Image de Konachan',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    try {
      await ctx.react('🖼️');
      const res = await fetch('https://konachan.com/posts.json?limit=1&tags=rating:safe');
      const data = await res.json();
      if (data.length > 0) {
        await sock.sendMessage(ctx.from, { image: { url: data[0].file_url }, caption: 'Image Konachan!' });
      } else {
        await ctx.reply('Pas d\'image trouvée.');
      }
    } catch (e) {
      await ctx.reply('Oups, le serveur Konachan est pas dispo.');
    }
  }
};
