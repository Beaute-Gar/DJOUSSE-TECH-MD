'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config } = env;
cmd('support', {
  cat: 10, desc: 'Support & signalement officiels', usage: 'support', icon: '🛟',
}, async (ctx) => {
  await ctx.reply(
    `🛟 *SUPPORT — DJOUSSE TECH*\n\n` +
    `🐛 Bug ou problème : ${config.social.github}/issues\n` +
    `💡 Idée / demande : ${config.social.github}/issues\n` +
    `📦 Code source : ${config.social.github}\n` +
    `🌐 Site : ${config.social.website}\n\n` +
    `_${config.slogan}_`
  );
});
};
module.exports.maison = true;
