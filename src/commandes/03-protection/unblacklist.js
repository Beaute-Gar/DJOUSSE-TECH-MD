'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, num, saveState, state, targetFrom } = env;
cmd('unblacklist', { cat: 3, desc: 'Retirer du blacklist', usage: 'unblacklist @user', group: true, owner: true }, async (ctx) => {
  const target = targetFrom(ctx);
  if (!target) return ctx.reply(`❌ ${config.prefix}unblacklist @user`);
  const who = num(target);
  state.blacklist = state.blacklist.filter((x) => x !== who);
  saveState();
  await ctx.reply(`✅ +${who} retiré du blacklist.`);
});
};
module.exports.maison = true;
