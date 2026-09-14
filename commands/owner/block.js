module.exports = {
  name: 'block',
  aliases: ['block'],
  category: 'owner',
  desc: 'Bloque un utilisateur',
  ownerOnly: true,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    let target;
    if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
      target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
    } else if (args.length > 0) {
      target = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    } else {
      return ctx.reply('Mentionne quelqu\'un ou écris le numéro.');
    }
    try {
      await sock.updateBlockStatus(target, 'block');
      await ctx.react('🚫');
      ctx.reply(`Utilisateur bloqué : ${target.split('@')[0]}`);
    } catch (e) {
      ctx.reply('Impossible de bloquer cet utilisateur...');
    }
  }
};
