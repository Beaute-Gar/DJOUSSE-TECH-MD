'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config } = env;
cmd('setdesc', ['setdescription'], { cat: 2, desc: 'Changer la description', usage: 'setdesc <texte>', group: true, admin: true, botAdmin: true }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}setdesc Description...`);
  await ctx.sock.groupUpdateDescription(ctx.from, ctx.q.slice(0, 500));
  await ctx.reply('✅ Description modifiée.');
});
};
module.exports.maison = true;
