module.exports = {
  name: 'broadcast',
  aliases: ['broadcast', 'bc'],
  category: 'owner',
  desc: 'Envoie un message à tous les groupes',
  ownerOnly: true,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    if (!args.length) return ctx.reply('Écris le message à broadcaster.');
    const text = args.join(' ');
    try {
      await ctx.react('📢');
      const groups = await sock.groupFetchAllParticipating();
      const groupIds = Object.keys(groups);
      let sent = 0;
      for (const gid of groupIds) {
        try {
          await sock.sendMessage(gid, { text: `📢 *Broadcast*\n\n${text}` });
          sent++;
        } catch (e) {}
      }
      ctx.reply(`Message envoyé dans ${sent} groupes.`);
    } catch (e) {
      ctx.reply('Erreur lors du broadcast...');
    }
  }
};
