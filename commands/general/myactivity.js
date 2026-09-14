const { getGroupStats } = require('../../utils/groupstats');

module.exports = {
  name: 'myactivity',
  aliases: ['myactivity', 'activity'],
  category: 'general',
  desc: 'Ton activité dans le groupe',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: true,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    if (!ctx.isGroup) {
      return await ctx.reply('C est une commande de groupe ça.');
    }
    try {
      await ctx.react('📈');
      const stats = getGroupStats(ctx.from);
      const userStats = stats.messages?.[ctx.sender] || { count: 0, today: 0, stickers: 0 };

      let text = `*Ton activité*\n\n`;
      text += `Messages total: ${userStats.count}\n`;
      text += `Aujourd'hui: ${userStats.today}\n`;
      text += `Stickers envoyés: ${userStats.stickers}\n`;
      await ctx.reply(text);
    } catch (e) {
      await ctx.reply('Oups, j\'ai pas récupéré tes stats.');
    }
  }
};
