const database = require('../../database');

module.exports = {
  name: 'chatbot',
  aliases: ['chatbot'],
  category: 'admin',
  desc: 'Active ou désactive le chatbot IA',
  ownerOnly: false,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const settings = database.getGroupSettings(ctx.from);
    const newState = !settings.chatbot;
    database.updateGroupSettings(ctx.from, { chatbot: newState });

    if (newState) {
      await ctx.react('🤖');
      return ctx.reply('Le chatbot IA est maintenant activé dans ce groupe.');
    } else {
      await ctx.react('✅');
      return ctx.reply('Le chatbot IA est maintenant désactivé dans ce groupe.');
    }
  }
};
