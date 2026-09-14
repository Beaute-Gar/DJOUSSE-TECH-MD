const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'setmenuimage',
  aliases: ['setmenuimage'],
  category: 'owner',
  desc: 'Définit l\'image du menu',
  ownerOnly: true,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const imageMsg = quoted?.imageMessage || msg.message?.imageMessage;

    if (!imageMsg && !args.length) return ctx.reply('Envoie une image ou un lien d\'image.');

    try {
      const configPath = path.join(__dirname, '../../config.js');
      let imageUrl = '';

      if (args.length > 0 && args[0].startsWith('http')) {
        imageUrl = args[0];
      } else if (imageMsg) {
        const stream = await sock.downloadMediaMessage(quoted || msg);
        const tmpPath = path.join(__dirname, '../../tmp/menu-image.jpg');
        fs.writeFileSync(tmpPath, stream);
        imageUrl = tmpPath;
      }

      global.menuImage = imageUrl;
      await ctx.react('✅');
      ctx.reply('Image du menu mise à jour !');
    } catch (e) {
      ctx.reply('Erreur lors de la mise à jour de l\'image...');
    }
  }
};
