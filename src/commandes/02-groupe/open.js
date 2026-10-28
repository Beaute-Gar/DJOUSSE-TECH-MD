'use strict';

module.exports = function enregistrer(env) {
  const { cmd } = env;
cmd('open', { cat: 2, desc: 'Ouvrir le groupe', group: true, admin: true, botAdmin: true }, async (ctx) => {
  await ctx.sock.groupSettingUpdate(ctx.from, 'not_announcement');
  await ctx.reply('🔓 Tous les membres peuvent écrire.');
});
};
module.exports.maison = true;
