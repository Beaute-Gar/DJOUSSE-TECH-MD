module.exports = {
  name: 'flirt',
  aliases: ['flirt'],
  category: 'fun',
  desc: 'Ligne de drague aléatoire',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const lines = [
      'T\'es un Wi-Fi ? Parce que je sens une connexion entre nous.',
      'T\'as une carte ? Parce que je me perds dans tes yeux.',
      'T\'es un()? Parce que t\'es mon type.',
      'Si t\'étais un fruit, t\'erais un manguier... parce que t\'es sucree.',
      'T\'as un plan ? Parce que j\'ai envie de passer du temps avec toi.',
      'T\'es une caméra ? Parce que chaque fois que je te vois, je souris.',
      'T\'es un soleil ? Parce que t\'éclaires ma journée.',
      'Si t\'étais une étoile, t\'aurais 5 bras. Parce que t\'es parfaite.',
      'T\'es un piège ? Parce que je suis tombé amoureux.',
      'T\'as un nom ? Parce que je dois l\'écrire sur mon cœur.',
      'T\'es un thème ? Parce que je veux te personnaliser.',
      'Si t\'étais une chanson, t\'aurais tous les awards.',
      'T\'es un nuage ? Parce que t\'es légère et belle.',
      'T\'as un carnet ? Parce que j\'ai envie d\'écrire notre histoire.',
      'T\'es un bijou ? Parce que t\'es précieuse.'
    ];
    const line = lines[Math.floor(Math.random() * lines.length)];

    let target;
    if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
      target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0].split('@')[0];
    } else if (args.length > 0) {
      target = args[0].replace(/[^0-9]/g, '');
    } else {
      target = ctx.sender.split('@')[0];
    }

    await ctx.react('😏');
    ctx.reply(`😏 Ligne de drague pour @${target} :\n\n${line}`, { mentions: [`${target}@s.whatsapp.net`] });
  }
};
