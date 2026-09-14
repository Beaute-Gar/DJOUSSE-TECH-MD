const database = require('../../database');

module.exports = {
  name: 'welcome',
  aliases: ['welcome'],
  category: 'admin',
  desc: 'Active ou désactive les messages de bienvenue',
  ownerOnly: false,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const settings = database.getGroupSettings(ctx.from);
    const newState = !settings.welcome;
    database.updateGroupSettings(ctx.from, { welcome: newState });

    if (newState) {
      await ctx.react('👋');
      return ctx.reply('Les messages de bienvenue sont maintenant activés. Nouveaux membres accueillis automatiquement.');
    } else {
      await ctx.react('✅');
      return ctx.reply('Les messages de bienvenue sont maintenant désactivés.');
    }
  }
};
