const database = require('../../database');

module.exports = {
  name: 'goodbye',
  aliases: ['goodbye', 'bye'],
  category: 'admin',
  desc: 'Active ou désactive les messages d\'au revoir',
  ownerOnly: false,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const settings = database.getGroupSettings(ctx.from);
    const newState = !settings.goodbye;
    database.updateGroupSettings(ctx.from, { goodbye: newState });

    if (newState) {
      await ctx.react('👋');
      return ctx.reply('Les messages d\'au revoir sont maintenant activés. Les membres qui quittent seront salués.');
    } else {
      await ctx.react('✅');
      return ctx.reply('Les messages d\'au revoir sont maintenant désactivés.');
    }
  }
};
