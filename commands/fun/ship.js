module.exports = {
  name: 'ship',
  aliases: ['ship'],
  category: 'fun',
  desc: 'Ship deux utilisateurs',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const sender = ctx.sender.split('@')[0];
    let target;

    if (args.length > 0) {
      target = args[0].replace(/[^0-9]/g, '');
    } else if (ctx.isGroup && msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
      target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0].split('@')[0];
    } else {
      return ctx.reply('Mentionne quelqu\'un ou écris son numéro pour le ship.');
    }

    const love = Math.floor(Math.random() * 101);
    let hearts = '';
    if (love >= 80) hearts = '❤️❤️❤️❤️❤️';
    else if (love >= 60) hearts = '❤️❤️❤️❤️';
    else if (love >= 40) hearts = '❤️❤️❤️';
    else if (love >= 20) hearts = '❤️❤️';
    else hearts = '❤️';

    let result;
    if (love >= 80) result = 'Vous êtes faits l\'un pour l\'autre !';
    else if (love >= 60) result = 'Y a un vrai potentiel là !';
    else if (love >= 40) result = 'Pas mal, continuez à discuter.';
    else if (love >= 20) result = 'Hmm, c\'est compliqué...';
    else result = 'Oubliez, c\'est mort.';

    await ctx.react('💕');
    ctx.reply(`💔 Ship Report 💔\n\n👤 ${sender}\n💫 x 💫\n👤 ${target}\n\n${hearts}\n💪 Amour : ${love}%\n\n${result}`);
  }
};
