'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config } = env;
cmd('setname', { cat: 2, desc: 'Changer le nom du groupe', usage: 'setname <nom>', group: true, admin: true, botAdmin: true }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}setname Mon groupe`);
  await ctx.sock.groupUpdateSubject(ctx.from, ctx.q.slice(0, 100));
  await ctx.reply('✅ Nom du groupe modifié.');
});
};
module.exports.maison = true;
