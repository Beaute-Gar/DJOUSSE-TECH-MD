const config = require('../../config');

module.exports = {
  name: 'setbotname',
  aliases: ['setbotname', 'botname'],
  category: 'owner',
  desc: 'Change le nom du bot',
  ownerOnly: true,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    if (!args.length) return ctx.reply('Écris le nouveau nom du bot.');
    const newName = args.join(' ');
    config.botName = newName;
    await ctx.react('✅');
    ctx.reply(`Nom du bot changé : ${newName}`);
  }
};
