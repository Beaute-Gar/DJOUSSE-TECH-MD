module.exports = {
  name: 'tagall',
  aliases: ['tagall'],
  category: 'admin',
  desc: 'Mentionne tous les membres du groupe',
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
      const text = args.join(' ') || 'Appel général !';

      let mentionText = `${text}\n\n`;
      for (const p of participants) {
        mentionText += `@${p.id.split('@')[0]}\n`;
      }

      await sock.sendMessage(ctx.from, {
        text: mentionText,
        mentions: mentions
      });
    } catch (err) {
      return ctx.reply('Impossible de récupérer la liste des membres.');
    }
  }
};
