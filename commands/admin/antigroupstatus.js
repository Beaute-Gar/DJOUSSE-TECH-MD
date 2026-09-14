const database = require('../../database');

module.exports = {
  name: 'antigroupstatus',
  aliases: ['antistatus'],
  category: 'admin',
  desc: 'Interdit les statuts de groupe',
  ownerOnly: false,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: true,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const settings = database.getGroupSettings(ctx.from);
    const newState = !settings.antigroupstatus;
    database.updateGroupSettings(ctx.from, { antigroupstatus: newState });

    if (newState) {
      await ctx.react('📵');
      return ctx.reply('L\'interdiction des statuts de groupe est maintenant active.');
    } else {
      await ctx.react('✅');
      return ctx.reply('Les statuts de groupe sont à nouveau autorisés.');
    }
  }
};
