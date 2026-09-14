const fetch = require('node-fetch');

module.exports = {
  name: 'memesearch',
  aliases: ['memesearch', 'msearch'],
  category: 'fun',
  desc: 'Recherche un mème',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    if (!args.length) return ctx.reply('Écris le nom du mème à chercher.');
    const query = args.join(' ');
    try {
      await ctx.react('🔍');
      const res = await fetch(`https://meme-api.com/gimme/${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!data.url) return ctx.reply('Aucun mème trouvé pour ça...');
      await sock.sendMessage(ctx.from, { image: { url: data.url }, caption: `Mème trouvé : ${data.title || query}` });
    } catch (e) {
      ctx.reply('Erreur lors de la recherche du mème.');
    }
  }
};
