const database = require('../../database');
const config = require('../../config');

module.exports = {
  name: 'warn',
  aliases: ['warn'],
  category: 'admin',
  desc: 'Avertit un utilisateur',
  ownerOnly: false,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    let target = null;
    const maxWarnings = config.maxWarnings || 3;

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
      return ctx.reply('Mentionne ou réponds au message de la personne à avertir.');
    }

    const reason = args.slice(1).join(' ') || 'Aucune raison spécifiée';
    const warning = database.addWarning(ctx.from, target, reason);

    await ctx.react('⚠️');

    if (warning.count >= maxWarnings) {
      try {
        await sock.groupParticipantsUpdate(ctx.from, [target], 'remove');
        database.clearWarnings(ctx.from, target);
        return ctx.reply(`@${target.split('@')[0]} a été expulsé après ${maxWarnings} avertissements.`);
      } catch (err) {
        return ctx.reply('Impossible d\'expulser cet utilisateur. Vérifie que le bot est admin.');
      }
    }

    return ctx.reply(
      `@${target.split('@')[0]} a reçu un avertissement.\n` +
      `Raison: ${reason}\n` +
      `Total: ${warning.count}/${maxWarnings} avertissements`
    );
  }
};
