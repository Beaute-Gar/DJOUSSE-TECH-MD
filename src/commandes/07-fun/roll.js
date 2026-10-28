'use strict';

module.exports = function enregistrer(env) {
  const { cmd } = env;
cmd('roll', { cat: 7, desc: 'Lancer de dé', usage: 'roll [faces]' }, async (ctx) => {
  const faces = Math.min(1000, Math.max(2, parseInt(ctx.args[0], 10) || 6));
  await ctx.reply(`🎲 *${Math.floor(Math.random() * faces) + 1}* / ${faces}`);
});
};
module.exports.maison = true;
