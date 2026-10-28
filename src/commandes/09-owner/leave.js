'use strict';

module.exports = function enregistrer(env) {
  const { cmd } = env;
cmd('leave', { cat: 9, desc: 'Quitter le groupe', group: true, owner: true }, async (ctx) => {
  await ctx.reply('👋 Je quitte ce groupe.');
  await ctx.sock.groupLeave(ctx.from);
});
};
module.exports.maison = true;
