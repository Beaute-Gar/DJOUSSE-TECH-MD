const database = require('../../database');

module.exports = {
  name: 'resetwarn',
  aliases: ['resetwarn', 'unwarn'],
  category: 'admin',
  desc: 'Réinitialise les avertissements d\'un utilisateur',
  ownerOnly: false,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: false,
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
      return ctx.reply('Mentionne ou réponds au message de la personne dont tu veux réinitialiser les avertissements.');
    }

    const warnings = database.getWarnings(ctx.from, target);
    if (warnings.count === 0) {
      return ctx.reply(`@${target.split('@')[0]} n'a aucun avertissement.`);
    }

    database.clearWarnings(ctx.from, target);
    await ctx.react('✅');
    return ctx.reply(`Les avertissements de @${target.split('@')[0]} ont été réinitialisés.`);
  }
};
