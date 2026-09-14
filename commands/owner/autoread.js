const autoread = require('../../utils/autoread');

module.exports = {
  name: 'autoread',
  aliases: ['autoread'],
  category: 'owner',
  desc: 'Active/désactive la lecture automatique',
  ownerOnly: true,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const newState = autoread.toggle();
    await ctx.react(newState ? '✅' : '❌');
    ctx.reply(`Lecture automatique : ${newState ? 'Activée' : 'Désactivée'}`);
  }
};
