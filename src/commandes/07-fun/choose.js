'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config } = env;
cmd('choose', { cat: 7, desc: 'Choisir entre options', usage: 'choose a, b, c' }, async (ctx) => {
  const options = ctx.q.split(/[,|]/).map((s) => s.trim()).filter(Boolean);
  if (options.length < 2) return ctx.reply(`❌ Usage : ${config.prefix}choose pizza, riz, pâtes`);
  await ctx.reply(`👉 Je choisis : *${options[Math.floor(Math.random() * options.length)]}*`);
});
};
module.exports.maison = true;
