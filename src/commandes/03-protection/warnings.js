'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, getGroup, guardDb, num, targetFrom } = env;
cmd('warnings', { cat: 3, desc: 'Voir les avertissements', usage: 'warnings @user', group: true, admin: true, icon: '📋' }, async (ctx) => {
  const target = targetFrom(ctx);
  if (!target) return ctx.reply(`❌ ${config.prefix}warnings @user`);
  const g = guardDb.db().getGroup(ctx.from);
  await ctx.reply(`⚠️ +${num(target)} : *${guardDb.db().getWarns(ctx.from, num(target))}/${g.warnLimit}* avertissements.`);
});
};
module.exports.maison = true;
