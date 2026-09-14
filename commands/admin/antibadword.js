const database = require('../../database');

module.exports = {
  name: 'antibadword',
  aliases: ['badword'],
  category: 'admin',
  desc: 'Filtre les gros mots dans le groupe',
  ownerOnly: false,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: true,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const settings = database.getGroupSettings(ctx.from);
    const newState = !settings.antibadword;
    database.updateGroupSettings(ctx.from, { antibadword: newState });

    if (newState) {
      await ctx.react('🚫');
      return ctx.reply('Le filtre gros mots est maintenant actif. Les messages inappropriate seront supprimés.');
    } else {
      await ctx.react('✅');
      return ctx.reply('Le filtre gros mots est maintenant désactivé.');
    }
  }
};
