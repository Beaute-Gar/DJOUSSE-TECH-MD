const afk = require('../../utils/afk');

module.exports = {
  name: 'afk',
  aliases: ['afk'],
  category: 'owner',
  desc: 'Mode AFK (absent)',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    if (afk.isEnabled()) {
      afk.disable();
      await ctx.react('✅');
      ctx.reply('Tu n\'es plus AFK.');
    } else {
      const message = args.length > 0 ? args.join(' ') : 'Je suis pas là pour l\'instant.';
      afk.enable(message);
      await ctx.react('😴');
      ctx.reply(`Mode AFK activé.\nMessage: ${message}`);
    }
  }
};
