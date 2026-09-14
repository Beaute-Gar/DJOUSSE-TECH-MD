const { getGroupStats } = require('../../utils/groupstats');

module.exports = {
  name: 'groupstats',
  aliases: ['groupstats', 'stats'],
  category: 'general',
  desc: 'Statistiques du groupe',
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
      await ctx.react('📊');
      const stats = getGroupStats(ctx.from);
      const messages = stats.messages || {};
      const sorted = Object.entries(messages)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10);

      let text = `*Stats du groupe*\n\n`;
      text += `Total messages: ${Object.values(messages).reduce((a, b) => a + b.count, 0)}\n`;
      text += `Membres actifs: ${Object.keys(messages).length}\n\n`;

      if (sorted.length > 0) {
        text += `*Top 10:*\n`;
        sorted.forEach(([jid, data], i) => {
          text += `${i + 1}. @${jid.split('@')[0]} - ${data.count} msgs\n`;
        });
      } else {
        text += 'Pas encore de stats.';
      }
      await ctx.reply(text);
    } catch (e) {
      await ctx.reply('Oups, problème avec les stats.');
    }
  }
};
