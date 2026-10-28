'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config } = env;
cmd('rate', { cat: 7, desc: 'Noter un sujet', usage: 'rate <chose>' }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}rate ce bot`);
  await ctx.reply(`⭐ *${Math.floor(Math.random() * 101)}%* pour « ${ctx.q.slice(0, 80)} »`);
});
};
module.exports.maison = true;
