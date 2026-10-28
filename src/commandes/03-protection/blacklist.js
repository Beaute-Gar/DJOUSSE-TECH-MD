'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, num, saveState, state, targetFrom } = env;
cmd('blacklist', { cat: 3, desc: 'Ajouter au blacklist (mute total)', usage: 'blacklist @user', group: true, owner: true }, async (ctx) => {
  const target = targetFrom(ctx);
  if (!target) return ctx.reply(`❌ ${config.prefix}blacklist @user`);
  const who = num(target);
  if (!state.blacklist.includes(who)) state.blacklist.push(who);
  saveState();
  await ctx.reply(`🚫 +${who} blacklisted : ses messages seront supprimés.`);
});
};
module.exports.maison = true;
