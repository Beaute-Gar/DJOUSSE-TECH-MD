const database = require('../../database');

module.exports = {
  name: 'setgoodbye',
  aliases: ['setgoodbye'],
  category: 'admin',
  desc: 'Définit le message d\'au revoir personnalisé',
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
        'Utilisation: .setgoodbye <message>\n\n' +
        'Variables disponibles:\n' +
        '- @user : mentionne le membre qui part\n' +
        '- @group : nom du groupe\n' +
        '- #memberCount : nombre de membres\n\n' +
        'Exemple: .setgoodbye Au revoir @user, tu vas nous manquer !'
      );
    }

    database.updateGroupSettings(ctx.from, { goodbyeMessage: text });
    await ctx.react('✅');
    return ctx.reply('Le message d\'au revoir a été mis à jour avec succès.');
  }
};
