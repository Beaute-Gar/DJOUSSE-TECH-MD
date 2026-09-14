const config = require('../../config');

module.exports = {
  name: 'mode',
  aliases: ['mode', 'self'],
  category: 'owner',
  desc: 'Change le mode du bot (public/privé)',
  ownerOnly: true,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    config.selfMode = !config.selfMode;
    await ctx.react(config.selfMode ? '🔒' : '🔓');
    ctx.reply(`Mode du bot changé : ${config.selfMode ? 'Privé (Self)' : 'Public'}`);
  }
};
