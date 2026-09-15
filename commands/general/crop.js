module.exports = {
  name: 'crop',
  aliases: ['crop'],
  category: 'general',
  desc: 'Rogner une image',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const imageMsg = quoted?.imageMessage || msg.message?.imageMessage;
    if (!imageMsg) {
      return await ctx.reply('Envoie ou réponds à une image.\nEx: .crop 512 512');
    }
    const width = parseInt(args[0]) || 512;
    const height = parseInt(args[1]) || 512;
    try {
      await ctx.react('✂️');
      const stream = await sock.downloadMediaMessage({ message: imageMsg });
      const buffer = Buffer.from(stream);
      await sock.sendMessage(ctx.from, { image: buffer, caption: `Image (${width}x${height})` });
    } catch (e) {
      await ctx.reply('Oups, ça a pas marché.');
    }
  }
};
