const api = require('../../utils/api');

module.exports = {
  name: 'ai',
  aliases: ['ai', 'gpt', 'chat'],
  category: 'ai',
  desc: 'Pose une question à l\'IA',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return await ctx.reply('Pose ta question.\nEx: .ai C\'est quoi la vie ?');
    }
    try {
      await ctx.react('🤖');
      const response = await api.gptResponse(text);
      await ctx.reply(response);
    } catch (e) {
      await ctx.reply('Oups, l\'IA est pas disponible là.');
    }
  }
};
