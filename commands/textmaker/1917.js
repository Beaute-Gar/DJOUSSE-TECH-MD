const fetch = require('node-fetch');

module.exports = {
  name: '1917',
  aliases: ['1917'],
  category: 'textmaker',
  desc: 'Génère un texte avec l\'effet 1917',
  groupOnly: false,
  execute: async (sock, msg, args, ctx) => {
    if (!args.length) return ctx.reply('Écris le texte à transformer.');
    const text = args.join(' ');
    try {
      await ctx.react('🎨');
      const url = `https://textpro.me/online-editor/1917-stencil-text-effect-844.html`;
      const apiUrl = `https://api.voidworks.xyz/api/textpro?query=${encodeURIComponent(text)}&style=1917`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (data.url) {
        await sock.sendMessage(ctx.from, { image: { url: data.url }, caption: `Effet 1917 : ${text}` });
      } else {
        ctx.reply('Impossible de générer l\'image...');
      }
    } catch (e) {
      ctx.reply('Erreur lors de la génération...');
    }
  }
};
