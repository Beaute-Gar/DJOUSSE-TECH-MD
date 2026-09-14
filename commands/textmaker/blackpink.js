const fetch = require('node-fetch');

module.exports = {
  name: 'blackpink',
  aliases: ['blackpink'],
  category: 'textmaker',
  desc: 'Génère un texte avec l\'effet blackpink',
  groupOnly: false,
  execute: async (sock, msg, args, ctx) => {
    if (!args.length) return ctx.reply('Écris le texte à transformer.');
    const text = args.join(' ');
    try {
      await ctx.react('🎨');
      const apiUrl = `https://api.voidworks.xyz/api/textpro?query=${encodeURIComponent(text)}&style=blackpink`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (data.url) {
        await sock.sendMessage(ctx.from, { image: { url: data.url }, caption: `Effet Blackpink : ${text}` });
      } else {
        ctx.reply('Impossible de générer l\'image...');
      }
    } catch (e) {
      ctx.reply('Erreur lors de la génération...');
    }
  }
};
