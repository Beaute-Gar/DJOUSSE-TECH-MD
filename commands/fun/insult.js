module.exports = {
  name: 'insult',
  aliases: ['insult', 'insulter'],
  category: 'fun',
  desc: 'Envoie une insulte (pour rire)',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const insults = [
      'T\'es aussi utile qu\'un parapluie dans un termitière.',
      'Si la bêtise était un sport, t\'es champion du monde.',
      'T\'as une tête à faire pleurer les murs.',
      'T\'es le genre de personne qu\'on mettrait en mode avion pour le silence.',
      'Même Google arrive pas à trouver tes qualités.',
      'T\'es pas vegan mais tu manges que de la merde.',
      'T\'as une personnalité deWi-Fi... t\'es pas toujours connecté.',
      'Si t\'étais un nuage, t\'aurais même pas de pluie.',
      'T\'es le草 patches de l\'humanité.',
      'Même ton reflet te fuit.',
      'T\'es comme une chaussette trouée... t\'as plus rien à offrir.',
      'Si t\'étais un film, t\'aurais 0% sur Rotten Tomatoes.',
      'T\'es le genre de gars qu\'on invite par erreur.',
      'T\'as une tête àDecolleté... t\'es pas beau à regarder.',
      'Si la bêtise faisait mal, t\'aurais mal au corps entier.'
    ];
    const insult = insults[Math.floor(Math.random() * insults.length)];

    let target;
    if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
      target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0].split('@')[0];
    } else if (args.length > 0) {
      target = args[0].replace(/[^0-9]/g, '');
    } else {
      target = ctx.sender.split('@')[0];
    }

    await ctx.react('🖕');
    ctx.reply(`🖕 Insulte pour @${target} :\n\n${insult}`, { mentions: [`${target}@s.whatsapp.net`] });
  }
};
