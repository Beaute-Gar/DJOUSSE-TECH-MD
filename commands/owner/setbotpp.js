const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'setbotpp',
  aliases: ['setbotpp'],
  category: 'owner',
  desc: 'Change la photo de profil du bot',
  ownerOnly: true,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const imageMsg = quoted?.imageMessage || msg.message?.imageMessage;

    if (!imageMsg) return ctx.reply('Envoie ou réponds à une image.');

    try {
      const stream = await sock.downloadMediaMessage(quoted || msg);
      const botJid = sock.user.id.replace(/:.*$/, '') + '@s.whatsapp.net';
      await sock.updateProfilePicture(botJid, stream);
      await ctx.react('✅');
      ctx.reply('Photo de profil du bot changée !');
    } catch (e) {
      ctx.reply('Erreur lors du changement de photo...');
    }
  }
};
