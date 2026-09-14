module.exports = {
  name: 'gayrate',
  aliases: ['gayrate', 'gay'],
  category: 'fun',
  desc: 'Taux de gayité aléatoire',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    let target;
    if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
      target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0].split('@')[0];
    } else if (args.length > 0) {
      target = args[0].replace(/[^0-9]/g, '');
    } else {
      target = ctx.sender.split('@')[0];
    }

    const rate = Math.floor(Math.random() * 101);
    let barre = '';
    const pleine = Math.floor(rate / 10);
    for (let i = 0; i < 10; i++) {
      barre += i < pleine ? '🟩' : '⬜';
    }

    let result;
    if (rate >= 90) result = 'Omlette du fromage.';
    else if (rate >= 70) result = 'T\'es pas discret du tout.';
    else if (rate >= 50) result = 'T\'es à mi-chemin.';
    else if (rate >= 30) result = 'Y a un petit quelque chose.';
    else result = 'T\'es plutôt hétéro.';

    await ctx.react('🏳️‍🌈');
    ctx.reply(`🏳️‍🌈 Taux de gayité 🏳️‍🌈\n\n👤 @${target}\n\n${barre}\n💪 Taux : ${rate}%\n\n${result}`, { mentions: [`${target}@s.whatsapp.net`] });
  }
};
