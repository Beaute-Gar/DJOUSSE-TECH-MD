'use strict';

module.exports = function enregistrer(env) {
  const { cmd } = env;
cmd('revoke', ['revokelink'], { cat: 2, desc: 'Révoquer le lien', group: true, admin: true, botAdmin: true }, async (ctx) => {
  try {
    await ctx.sock.groupRevokeInvite(ctx.from);
    await ctx.reply('✅ Lien révoqué.');
  } catch (e) {
    await ctx.reply(`❌ Échec : ${e.message}`);
  }
});
};
module.exports.maison = true;
