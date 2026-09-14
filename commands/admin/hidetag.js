module.exports = {
  name: 'hidetag',
  aliases: ['hidetag'],
  category: 'admin',
  desc: 'Mentionne tous les membres du groupe (caché)',
  ownerOnly: false,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    try {
      const meta = await sock.groupMetadata(ctx.from);
      const participants = meta.participants || [];
      const mentions = participants.map(p => p.id);
      const text = args.join(' ') || ' ';

      await sock.sendMessage(ctx.from, {
        text: text,
        mentions: mentions
      });
    } catch (err) {
      return ctx.reply('Impossible de récupérer la liste des membres.');
    }
  }
};
