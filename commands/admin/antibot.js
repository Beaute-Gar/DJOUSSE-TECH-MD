const database = require('../../database');

module.exports = {
  name: 'antibot',
  aliases: ['antibot'],
  category: 'admin',
  desc: 'Détecte les autres bots dans le groupe',
  ownerOnly: false,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: true,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const settings = database.getGroupSettings(ctx.from);
    const newState = !settings.antibot;
    database.updateGroupSettings(ctx.from, { antibot: newState });

    if (newState) {
      await ctx.react('🤖');
      return ctx.reply('La détection des bots est maintenant active. Les autres bots seront repérés.');
    } else {
      await ctx.react('✅');
      return ctx.reply('La détection des bots est maintenant désactivée.');
    }
  }
};
