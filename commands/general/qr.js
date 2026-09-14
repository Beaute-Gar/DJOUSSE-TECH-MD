const QRCode = require('qrcode');

module.exports = {
  name: 'qr',
  aliases: ['qr', 'qrcode'],
  category: 'general',
  desc: 'Génère un QR code',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return await ctx.reply('Écris un lien ou du texte pour générer le QR code.');
    }
    try {
      await ctx.react('📱');
      const buffer = await QRCode.toBuffer(text, { width: 512, margin: 2 });
      await sock.sendMessage(ctx.from, { image: buffer, caption: `QR code pour: ${text}` });
    } catch (e) {
      await ctx.reply('Oups, j\'ai pas réussi à faire le QR code.');
    }
  }
};
