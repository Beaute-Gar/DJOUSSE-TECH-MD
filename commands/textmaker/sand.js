const fetch = require('node-fetch');

module.exports = {
  name: 'sand',
  aliases: ['sand'],
  category: 'textmaker',
  desc: 'Génère un texte avec l\'effet sand',
  groupOnly: false,
  execute: async (sock, msg, args, ctx) => {
    if (!args.length) return ctx.reply('Écris le texte à transformer.');
    const text = args.join(' ');
    try {
      await ctx.react('🏖️');
      const apiUrl = `https://api.voidworks.xyz/api/textpro?query=${encodeURIComponent(text)}&style=sand`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (data.url) {
        await sock.sendMessage(ctx.from, { image: { url: data.url }, caption: `Effet Sand : ${text}` });
      } else {
        ctx.reply('Impossible de générer l\'image...');
      }
    } catch (e) {
      ctx.reply('Erreur lors de la génération...');
    }
  }
};
