module.exports = {
  name: 'dare',
  aliases: ['dare', 'defi'],
  category: 'fun',
  desc: 'Donne un défi aléatoire',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const defis = [
      'Envoie un message vocal en chantant ton prénom.',
      'Fais 10 pompas en vocal.',
      'Change ta photo de profil en truc drôle pendant 1 heure.',
      'Envoie un emoji à tout le monde dans le groupe.',
      'Fais imiter un animal en vocal.',
      'Raconte une blague en 30 secondes.',
      'Fais un compliment sincère à la dernière personne qui a parlé.',
      'Écris un poème de 4 vers sur le groupe.',
      'Envoie une photo de toi en train de faire une tête bizarre.',
      'Fais du karaoké en vocal pendant 1 minute.',
      'Dis "je suis le meilleur" 5 fois en vocal.',
      'Imite le son d\'un téléphone qui sonne.',
      'Raconte ton plus gros échec.',
      'Fais un discours de motivation de 30 secondes.',
      'Chante la choré d\'une chanson connue.'
    ];
    const defi = defis[Math.floor(Math.random() * defis.length)];
    await ctx.react('🔥');
    ctx.reply(`🎯 Défi pour toi :\n\n${defi}`);
  }
};
