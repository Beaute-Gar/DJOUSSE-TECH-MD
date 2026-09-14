module.exports = {
  name: 'mute',
  aliases: ['mute', 'close'],
  category: 'admin',
  desc: 'Ferme le groupe (seuls les admins peuvent écrire)',
  ownerOnly: false,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: true,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    try {
      await sock.groupSettingUpdate(ctx.from, 'announcement');
      await ctx.react('🔇');
      return ctx.reply('Le groupe est maintenant fermé. Seuls les admins peuvent écrire.');
    } catch (err) {
      return ctx.reply('Impossible de fermer le groupe. Vérifie que le bot est admin.');
    }
  }
};
