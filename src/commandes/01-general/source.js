'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config } = env;
cmd('source', { cat: 1, desc: 'Code source du bot' }, async (ctx) => {
  await ctx.reply(`📂 Code source :\n${config.social.github}`);
});
};
module.exports.maison = true;
