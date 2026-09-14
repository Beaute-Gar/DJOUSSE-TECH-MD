module.exports = {
  name: 'ping',
  aliases: ['ping'],
  category: 'general',
  desc: 'Vérifie la latence du bot',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const start = Date.now();
    await ctx.react('🏓');
    const latency = Date.now() - start;
    await ctx.reply(`Latence: ${latency}ms`);
  }
};
