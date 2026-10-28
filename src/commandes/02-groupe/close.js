'use strict';

module.exports = function enregistrer(env) {
  const { cmd } = env;
cmd('close', { cat: 2, desc: 'Fermer le groupe (admins)', group: true, admin: true, botAdmin: true }, async (ctx) => {
  await ctx.sock.groupSettingUpdate(ctx.from, 'announcement');
  await ctx.reply('🔒 Seuls les admins peuvent écrire.');
});
};
module.exports.maison = true;
