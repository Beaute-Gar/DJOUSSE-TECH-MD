'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, getGroup, guardDb, guardSanctions, num, targetFrom } = env;
cmd('warn', { cat: 3, desc: 'Avertir un membre', usage: 'warn @user [raison]', group: true, admin: true, icon: '⚠️' }, async (ctx) => {
  const target = targetFrom(ctx);
  if (!target) return ctx.reply(`❌ ${config.prefix}warn @user [raison]`);
  const g = guardDb.db().getGroup(ctx.from);
  const reason = ctx.q.replace(/@\d+/g, '').trim() || 'raison non précisée';
  const r = await guardSanctions.warn(ctx.sock, ctx.from, target, g, ctx.isBotAdmin);
  let txt = `⚠️ @${num(target)} : avertissement *${Math.min(r.count, r.limit)}/${r.limit}*\nRaison : ${reason}`;
  if (r.escalated === 'kick') txt += '\n🚫 Limite atteinte : expulsion.';
  else if (r.escalated === 'mute') txt += `\n🔇 Limite atteinte : muet ${g.muteMinutes} min.`;
  else if (r.count >= r.limit) txt += '\n⚠️ Limite atteinte mais le bot n\u2019est pas admin : pas d\u2019expulsion.';
  await ctx.reply(txt, [target]);
});
};
module.exports.maison = true;
