const config = require('../../config');

module.exports = {
  name: 'setprefix',
  aliases: ['setprefix', 'prefix'],
  category: 'owner',
  desc: 'Change le préfixe des commandes',
  ownerOnly: true,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    if (!args.length) return ctx.reply('Écris le nouveau préfixe.');
    const newPrefix = args[0];
    config.prefix = newPrefix;
    await ctx.react('✅');
    ctx.reply(`Préfixe changé : ${newPrefix}`);
  }
};
