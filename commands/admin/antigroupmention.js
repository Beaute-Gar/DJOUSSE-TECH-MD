const database = require('../../database');

module.exports = {
  name: 'antigroupmention',
  aliases: ['antimention'],
  category: 'admin',
  desc: 'Protège contre les mentions de groupe',
  ownerOnly: false,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: true,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const settings = database.getGroupSettings(ctx.from);
    const newState = !settings.antigroupmention;
    database.updateGroupSettings(ctx.from, { antigroupmention: newState });

    if (newState) {
      await ctx.react('📢');
      return ctx.reply('La protection contre les mentions de groupe est maintenant active.');
    } else {
      await ctx.react('✅');
      return ctx.reply('La protection contre les mentions de groupe est maintenant désactivée.');
    }
  }
};
