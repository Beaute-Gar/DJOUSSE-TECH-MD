module.exports = {
  name: 'truth',
  aliases: ['truth', 'verite'],
  category: 'fun',
  desc: 'Pose une question vérité',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const questions = [
      'Quel est ton plus grand secret ?',
      'Tu as déjà menti à quelqu\'un que tu aimes ?',
      'C\'est quoi ton plus grand regret ?',
      'Tu as déjà volé quelque chose ?',
      'C\'est quoi la chose la plus gênante que t\'as faite ?',
      'Tu as déjà été amoureux de quelqu\'un qui savait pas ?',
      'C\'est quoi ton péché mignon ?',
      'Tu as déjà triché à un jeu ?',
      'C\'est le truc le plus bizarre que t\'as mangé ?',
      'Tu as déjà crié sur tes parents ?',
      'C\'est quoi ton plus grand freud ?',
      'Tu as déjà fait pleurer quelqu\'un exprès ?',
      'C\'est quoi ton fantasme le plus fou ?',
      'Tu as déjà été en retard pour un truc super important ?',
      'C\'est quoi ton opinion impopulaire ?'
    ];
    const question = questions[Math.floor(Math.random() * questions.length)];
    await ctx.react('🤔');
    ctx.reply(`❓ Vérité :\n\n${question}`);
  }
};
