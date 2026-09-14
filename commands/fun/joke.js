const api = require('../../utils/api');

module.exports = {
  name: 'joke',
  aliases: ['joke', 'blague'],
  category: 'fun',
  desc: 'Raconte une blague',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    try {
      await ctx.react('😂');
      const joke = await api.getJoke();
      ctx.reply(joke);
    } catch (e) {
      ctx.reply('Impossible de trouver une blague là...');
    }
  }
};
