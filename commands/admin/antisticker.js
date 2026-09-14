const database = require('../../database');

module.exports = {
  name: 'antisticker',
  aliases: ['antisticker'],
  category: 'admin',
  desc: 'Interdit les stickers dans le groupe',
  ownerOnly: false,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: true,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const settings = database.getGroupSettings(ctx.from);
    const newState = !settings.antisticker;
    database.updateGroupSettings(ctx.from, { antisticker: newState });

    if (newState) {
      await ctx.react('🖼️');
      return ctx.reply('L\'interdiction des stickers est maintenant active. Les stickers seront supprimés.');
    } else {
      await ctx.react('✅');
      return ctx.reply('Les stickers sont à nouveau autorisés dans le groupe.');
    }
  }
};
