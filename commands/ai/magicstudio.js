const fetch = require('node-fetch');
const config = require('../../config');

module.exports = {
  name: 'magicstudio',
  aliases: ['magicstudio', 'magic'],
  category: 'ai',
  desc: 'Édite une image avec l\'IA',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const imageMsg = quoted?.imageMessage || msg.message?.imageMessage;
    if (!imageMsg || !args.length) {
      return await ctx.reply('Envoie une image avec un prompt.\nEx: .magicstudio ajoute des ailes');
    }
    const prompt = args.join(' ');
    try {
      await ctx.react('🪄');
      const stream = await sock.downloadMediaMessage({ message: imageMsg });
      const buffer = Buffer.from(stream);

      const FormData = require('form-data');
      const form = new FormData();
      form.append('image', buffer, { filename: 'image.png', contentType: 'image/png' });
      form.append('prompt', prompt);

      const res = await fetch('https://api.voidworks.xyz/api/magicstudio', {
        method: 'POST',
        body: form
      });
      const data = await res.json();

      if (data.url) {
        await sock.sendMessage(ctx.from, { image: { url: data.url }, caption: `Image éditée: ${prompt}` });
      } else {
        await ctx.reply('L\'édition a pas marché. Réessaie.');
      }
    } catch (e) {
      await ctx.reply('Oups, le magic studio est pas dispo.');
    }
  }
};
