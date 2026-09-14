module.exports = {
  name: 'uptime',
  aliases: ['uptime', 'runtime'],
  category: 'general',
  desc: 'Montre depuis quand le bot tourne',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = Math.floor(uptime % 60);
    await ctx.reply(`Le bot tourne depuis ${h}h ${m}m ${s}s`);
  }
};
