module.exports = {
  name: 'pending',
  aliases: ['pending', 'request'],
  category: 'admin',
  desc: 'Liste les demandes d\'adhésion en attente',
  ownerOnly: false,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: true,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    try {
      const requests = await sock.groupRequestParticipantsList(ctx.from);

      if (!requests || requests.length === 0) {
        return ctx.reply('Aucune demande d\'adhésion en attente.');
      }

      let text = `Demandes en attente (${requests.length}):\n\n`;
      for (const req of requests) {
        const num = req.jid ? req.jid.split('@')[0] : req.split('@')[0];
        text += `@${num}\n`;
      }

      const mentions = requests.map(r => r.jid || r);

      await ctx.react('📋');
      await sock.sendMessage(ctx.from, { text, mentions });
    } catch (err) {
      return ctx.reply('Impossible de récupérer les demandes. Vérifie que le bot est admin.');
    }
  }
};
