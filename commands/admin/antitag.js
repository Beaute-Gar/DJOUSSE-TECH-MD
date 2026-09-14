const database = require('../../database');

module.exports = {
  name: 'antitag',
  aliases: ['antitag'],
  category: 'admin',
  desc: 'Protège contre le spam de tags',
  ownerOnly: false,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: true,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const settings = database.getGroupSettings(ctx.from);
    const newState = !settings.antitag;
    database.updateGroupSettings(ctx.from, { antitag: newState });

    if (newState) {
      await ctx.react('🏷️');
      return ctx.reply('La protection antitag est maintenant active. Le spam de tags sera bloqué.');
    } else {
      await ctx.react('✅');
      return ctx.reply('La protection antitag est maintenant désactivée.');
    }
  }
};
