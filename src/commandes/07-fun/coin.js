'use strict';

module.exports = function enregistrer(env) {
  const { cmd } = env;
cmd('coin', { cat: 7, desc: 'Pile ou face' }, async (ctx) => {
  await ctx.reply(Math.random() < 0.5 ? '🪙 *Pile*' : '🪙 *Face*');
});
};
module.exports.maison = true;
