const config = require('../../config');

module.exports = {
  name: 'autoreact',
  aliases: ['autoreact'],
  category: 'owner',
  desc: 'Active/désactive les réactions automatiques',
  ownerOnly: true,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    config.autoReact = !config.autoReact;
    await ctx.react(config.autoReact ? '✅' : '❌');
    ctx.reply(`Réactions automatiques : ${config.autoReact ? 'Activées' : 'Désactivées'}`);
  }
};
