const database = require('../../database');

module.exports = {
  name: 'autosticker',
  aliases: ['autosticker', 'autostiker'],
  category: 'admin',
  desc: 'Convertit automatiquement les images en stickers',
  ownerOnly: false,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const settings = database.getGroupSettings(ctx.from);
    const newState = !settings.autosticker;
    database.updateGroupSettings(ctx.from, { autosticker: newState });

    if (newState) {
      await ctx.react('🖼️');
      return ctx.reply('La conversion automatique des images en stickers est maintenant active.');
    } else {
      await ctx.react('✅');
      return ctx.reply('La conversion automatique des images en stickers est maintenant désactivée.');
    }
  }
};
