module.exports = {
  name: 'restart',
  aliases: ['restart'],
  category: 'owner',
  desc: 'Redémarre le bot',
  ownerOnly: true,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    await ctx.react('🔄');
    ctx.reply('Redémarrage en cours...');
    setTimeout(() => {
      process.exit(0);
    }, 2000);
  }
};
