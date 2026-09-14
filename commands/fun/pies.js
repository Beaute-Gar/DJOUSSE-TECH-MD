module.exports = {
  name: 'pies',
  aliases: ['pies', 'tarte'],
  category: 'fun',
  desc: 'Lance une tarte sur quelqu\'un',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const actions = [
      'une tarte à la crème',
      'une tarte au citron',
      'une tarte aux fraises',
      'une pizza',
      'un gâteau au chocolat',
      'une crème brûlée',
      'une tarte tatin',
      'un mille-feuille',
      'une tarte aux pommes',
      'un éclair au chocolat'
    ];

    const targets = [
      'en plein visage',
      'dans le dos',
      'sur la tête',
      'dans les cheveux',
      'sur les lunettes',
      'en pleine poitrine'
    ];

    const action = actions[Math.floor(Math.random() * actions.length)];
    const target = targets[Math.floor(Math.random() * targets.length)];

    let who;
    if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
      who = msg.message.extendedTextMessage.contextInfo.mentionedJid[0].split('@')[0];
    } else if (args.length > 0) {
      who = args[0].replace(/[^0-9]/g, '');
    } else {
      who = ctx.sender.split('@')[0];
    }

    await ctx.react('🥧');
    ctx.reply(`🥧 @${ctx.sender.split('@')[0]} lance ${action} ${target} sur @${who} !\n\n💥 SPLASH !`, {
      mentions: [`${who}@s.whatsapp.net`, `${ctx.sender.split('@')[0]}@s.whatsapp.net`]
    });
  }
};
