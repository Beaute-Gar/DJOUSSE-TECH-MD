module.exports = {
  name: 'grouplink',
  aliases: ['grouplink', 'glink'],
  category: 'admin',
  desc: 'Obtient le lien d\'invitation du groupe',
  ownerOnly: false,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: true,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    try {
      const code = await sock.groupInviteCode(ctx.from);
      const link = `https://chat.whatsapp.com/${code}`;
      await ctx.react('🔗');
      return ctx.reply(`Lien d'invitation du groupe:\n${link}`);
    } catch (err) {
      return ctx.reply('Impossible de récupérer le lien. Vérifie que le bot est admin.');
    }
  }
};
