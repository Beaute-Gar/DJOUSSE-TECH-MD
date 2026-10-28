'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, guardDb, num, targetFrom } = env;
cmd('unwarn', ['resetwarn'], { cat: 3, desc: 'Retirer les avertissements', usage: 'unwarn @user', group: true, admin: true, icon: '♻️' }, async (ctx) => {
  const target = targetFrom(ctx);
  if (!target) return ctx.reply(`❌ ${config.prefix}unwarn @user`);
  guardDb.db().setWarns(ctx.from, num(target), 0);
  await ctx.reply(`✅ Avertissements remis à zéro pour +${num(target)}.`);
});
};
module.exports.maison = true;
