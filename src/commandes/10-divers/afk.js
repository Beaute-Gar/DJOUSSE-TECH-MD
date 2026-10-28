'use strict';

module.exports = function enregistrer(env) {
  const { cmd, getUser, num, saveState } = env;
cmd('afk', { cat: 10, desc: 'Se déclarer AFK', usage: 'afk [raison]' }, async (ctx) => {
  const u = getUser(num(ctx.sender));
  u.afk = { reason: ctx.q || 'sans raison', ts: Date.now() };
  saveState();
  await ctx.reply(`💤 *+${num(ctx.sender)}* est AFK ${u.afk.reason ? `: ${u.afk.reason}` : ''}`);
});
};
module.exports.maison = true;
