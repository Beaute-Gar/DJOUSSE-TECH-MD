module.exports = {
  name: 'demote',
  aliases: ['demote', 'dm'],
  category: 'admin',
  desc: 'Rétrograde un admin au rang de membre',
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
      return ctx.reply('Mentionne ou réponds au message de l\'admin à rétrograder.');
    }

    try {
      await sock.groupParticipantsUpdate(ctx.from, [target], 'demote');
      await ctx.react('⬇️');
      return ctx.reply(`@${target.split('@')[0]} a été rétrogradé au rang de membre.`);
    } catch (err) {
      return ctx.reply('Impossible de rétrograder cet admin. Vérifie que le bot est admin.');
    }
  }
};
