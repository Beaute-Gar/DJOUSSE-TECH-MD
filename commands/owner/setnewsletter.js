const config = require('../../config');

module.exports = {
  name: 'setnewsletter',
  aliases: ['setnewsletter'],
  category: 'owner',
  desc: 'Définit le newsletter JID',
  ownerOnly: true,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    if (!args.length) return ctx.reply('Écris le JID du newsletter.');
    config.newsletterJid = args[0];
    await ctx.react('✅');
    ctx.reply(`Newsletter JID défini : ${args[0]}`);
  }
};
