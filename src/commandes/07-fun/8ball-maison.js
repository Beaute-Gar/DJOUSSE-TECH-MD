'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config } = env;
cmd('8ball', { cat: 7, desc: 'Boule magique', usage: '8ball <question>' }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}8ball Est-ce que je vais réussir ?`);
  const answers = ['✅ Oui, sûrement.', '❌ Non, jamais.', '🤔 Peut-être...', '🌟 Très probable.', '💀 Pas du tout.', '⏳ Réessaie plus tard.', '😉 Tu connais la réponse.', '🎲 Les signes sont flous.'];
  await ctx.reply(`🎱 *${ctx.q}*\n\n${answers[Math.floor(Math.random() * answers.length)]}`);
});
};
module.exports.maison = true;
