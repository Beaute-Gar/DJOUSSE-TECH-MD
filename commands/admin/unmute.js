module.exports = {
  name: 'unmute',
  aliases: ['unmute', 'open'],
  category: 'admin',
  desc: 'Rouvre le groupe pour tous les membres',
  ownerOnly: false,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: true,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    try {
      await sock.groupSettingUpdate(ctx.from, 'not_announcement');
      await ctx.react('🔊');
      return ctx.reply('Le groupe est maintenant ouvert. Tous les membres peuvent écrire.');
    } catch (err) {
      return ctx.reply('Impossible d\'ouvrir le groupe. Vérifie que le bot est admin.');
    }
  }
};
