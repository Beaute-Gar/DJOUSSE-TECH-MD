const config = require('../../config');

module.exports = {
  name: 'owner',
  aliases: ['owner', 'creator', 'dev'],
  category: 'general',
  desc: 'Affiche le propriétaire du bot',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const owners = Array.isArray(config.ownerName) ? config.ownerName : [config.ownerName];
    const numbers = Array.isArray(config.ownerNumber) ? config.ownerNumber : [config.ownerNumber];
    let text = '*Propriétaire du bot*\n\n';
    for (let i = 0; i < owners.length; i++) {
      text += `Nom: ${owners[i]}\n`;
      if (numbers[i]) text += `Numéro: ${numbers[i]}\n`;
      text += '\n';
    }
    await ctx.reply(text.trim());
  }
};
