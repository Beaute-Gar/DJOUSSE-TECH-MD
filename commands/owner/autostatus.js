const autostatus = require('../../utils/autostatus');

module.exports = {
  name: 'autostatus',
  aliases: ['autostatus'],
  category: 'owner',
  desc: 'Active/désactive le visionnage automatique des statuts',
  ownerOnly: true,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const newState = autostatus.toggle();
    await ctx.react(newState ? '✅' : '❌');
    ctx.reply(`Visionnage automatique des statuts : ${newState ? 'Activé' : 'Désactivé'}`);
  }
};
