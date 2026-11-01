'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config } = env;
cmd('setbio', ['botbio'], {
  cat: 9, desc: 'Changer la bio (status) du bot', usage: 'setbio <texte>', owner: true, icon: '💬',
}, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}setbio En ligne`);
  try {
    await ctx.sock.updateProfileStatus(ctx.q.slice(0, 139));
    await ctx.success(['BIO MISE À JOUR']);
  } catch (e) {
    await ctx.reply(`❌ setbio impossible : ${e.message}`);
  }
});
};
module.exports.maison = true;
