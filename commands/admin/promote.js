module.exports = {
  name: 'promote',
  aliases: ['promote', 'pm'],
  category: 'admin',
  desc: 'Promouvoir un membre au rang d\'admin',
  ownerOnly: false,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: true,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    let target = null;

    if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
      target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
    } else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
      target = msg.message.extendedTextMessage.contextInfo.participant;
    } else if (args[0]) {
      const num = args[0].replace(/[^0-9]/g, '');
      if (num.length >= 6) {
        target = num + '@s.whatsapp.net';
      }
    }

    if (!target) {
      return ctx.reply('Mentionne ou réponds au message de la personne à promouvoir.');
    }

    try {
      await sock.groupParticipantsUpdate(ctx.from, [target], 'promote');
      await ctx.react('⬆️');
      return ctx.reply(`@${target.split('@')[0]} est maintenant admin du groupe.`);
    } catch (err) {
      return ctx.reply('Impossible de promouvoir cet utilisateur. Vérifie que le bot est admin.');
    }
  }
};
