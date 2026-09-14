const database = require('../../database');

module.exports = {
  name: 'setwelcome',
  aliases: ['setwelcome'],
  category: 'admin',
  desc: 'Définit le message de bienvenue personnalisé',
  ownerOnly: false,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const text = args.join(' ').trim();
    if (!text) {
      return ctx.reply(
        'Utilisation: .setwelcome <message>\n\n' +
        'Variables disponibles:\n' +
        '- @user : mentionne le nouveau membre\n' +
        '- @group : nom du groupe\n' +
        '- #memberCount : nombre de membres\n\n' +
        'Exemple: .setwelcome Bienvenue @user dans @group ! Il y a #memberCount membres.'
      );
    }

    database.updateGroupSettings(ctx.from, { welcomeMessage: text });
    await ctx.react('✅');
    return ctx.reply('Le message de bienvenue a été mis à jour avec succès.');
  }
};
