'use strict';

module.exports = function enregistrer(env) {
  const { cmd } = env;
cmd('link', ['grouplink'], { cat: 2, desc: 'Lien d’invitation', group: true, admin: true }, async (ctx) => {
  try {
    const code = await ctx.sock.groupInviteCode(ctx.from);
    await ctx.reply(`🔗 https://chat.whatsapp.com/${code}`);
  } catch (e) {
    await ctx.reply('❌ Impossible (je dois être admin).');
  }
});
};
module.exports.maison = true;
