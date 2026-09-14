module.exports = {
  name: 'complimentry',
  aliases: ['compliment', 'comp'],
  category: 'fun',
  desc: 'Envoie un compliment',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const compliments = [
      'T\'es quelqu\'un de vraiment génial, continue comme ça.',
      'T\'as le power de rendre les gens heureux juste en étant toi.',
      'Ton sourire illumine n\'importe quelle pièce.',
      'T\'es plus brillant que le soleil.',
      'Les gens ont de la chance de t\'avoir dans leur vie.',
      'T\'es unique et c\'est ça qui te rend spécial.',
      'T\'as un cœur en or.',
      'T\'es la meilleure personne que je connaisse.',
      'T\'es tellement cool que même le glacier t\'envie.',
      'T\'es le genre de personne qu\'on voudrait avoir comme meilleur pote.',
      'T\'es aussi lumineux qu\'une étoile.',
      'T\'as un génie naturel.',
      'Les gens t\'adorent et c\'est mérité.',
      'T\'es la définition de la perfection.',
      'T\'es le truc le plus beau qui soit.'
    ];
    const compliment = compliments[Math.floor(Math.random() * compliments.length)];

    let target;
    if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
      target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0].split('@')[0];
    } else if (args.length > 0) {
      target = args[0].replace(/[^0-9]/g, '');
    } else {
      target = ctx.sender.split('@')[0];
    }

    await ctx.react('❤️');
    ctx.reply(`❤️ Compliment pour @${target} :\n\n${compliment}`, { mentions: [`${target}@s.whatsapp.net`] });
  }
};
