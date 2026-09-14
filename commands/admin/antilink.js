const database = require('../../database');

module.exports = {
  name: 'antilink',
  aliases: ['antilink'],
  category: 'admin',
  desc: 'Active ou désactive la protection antilink',
  ownerOnly: false,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: true,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const settings = database.getGroupSettings(ctx.from);
    const newState = !settings.antilink;
    database.updateGroupSettings(ctx.from, { antilink: newState });

    if (newState) {
      await ctx.react('🔗');
      return ctx.reply('La protection antilink est maintenant active. Les liens seront supprimés automatiquement.');
    } else {
      await ctx.react('🚫');
      return ctx.reply('La protection antilink est maintenant désactivée. Les liens sont à nouveau autorisés.');
    }
  }
};
