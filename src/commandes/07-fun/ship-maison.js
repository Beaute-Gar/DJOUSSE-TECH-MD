'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, ctxInfo, num } = env;
cmd('ship', { cat: 7, desc: 'Taux de compatibilité', usage: 'ship @a @b' }, async (ctx) => {
  const ci = ctxInfo(ctx.content);
  const mentioned = ci?.mentionedJid || [];
  if (mentioned.length < 2) return ctx.reply(`❌ Mentionne 2 personnes.\nUsage : ${config.prefix}ship @a @b`);
  const pct = Math.floor(Math.random() * 101);
  const verdict = pct >= 80 ? '💘 Coup de foudre !' : pct >= 50 ? '💞 Ça peut marcher' : pct >= 30 ? '💔 Peu probable' : '🗑️ Oublie ça...';
  await ctx.reply(
    `💘 *SHIP*\n@${num(mentioned[0])} ❤️ @${num(mentioned[1])}\n\n*${pct}%*\n${verdict}`,
    mentioned
  );
});
};
module.exports.maison = true;
