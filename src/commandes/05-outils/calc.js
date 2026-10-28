'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, math } = env;
cmd('calc', ['calculate'], { cat: 5, desc: 'Calculatrice', usage: 'calc 2+2*3' }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}calc 12*8+4`);
  try {
    const raw = ctx.q.slice(0, 200);
    // Validation en entrée : uniquement caractères mathématiques (aucun
    // crochet, accolade, guillemet ou antislash n'atteint math.evaluate).
    if (!/^[0-9a-zA-Z\s+\-*/^().,%]+$/.test(raw)) {
      return ctx.reply('❌ Expression invalide : caractères autorisés limités aux chiffres, lettres et opérateurs.');
    }
    const expr = raw
      .replace(/\bMath\.PI\b/g, 'pi')
      .replace(/\bMath\.E\b/g, 'e')
      .replace(/\bMath\./g, '')
      .replace(/\*\*/g, '^');
    const result = math.evaluate(expr);
    await ctx.reply(`🧮 \`${raw}\` = *${result}*`);
  } catch (e) {
    await ctx.reply('❌ Expression invalide.');
  }
});
};
module.exports.maison = true;
