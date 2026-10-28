'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config } = env;
cmd('setbotname', ['botname'], {
  cat: 9, desc: 'Changer le nom affiché du bot', usage: 'setbotname <nom>', owner: true, icon: '📝',
}, async (ctx) => {
  if (!ctx.q || ctx.q.length < 2) return ctx.reply(`❌ Usage : ${config.prefix}setbotname Nouveau Nom`);
  try {
    await ctx.sock.updateProfileName(ctx.q.slice(0, 25));
    await ctx.success([`NOM → ${ctx.q.slice(0, 25)}`]);
  } catch (e) {
    await ctx.reply(`❌ setbotname impossible : ${e.message}`);
  }
});
};
module.exports.maison = true;
