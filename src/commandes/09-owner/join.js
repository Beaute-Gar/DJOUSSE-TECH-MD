'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config } = env;
cmd('join', { cat: 9, desc: 'Rejoindre un groupe via lien', usage: 'join <lien>', owner: true }, async (ctx) => {
  const code = (ctx.q || '').match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]+)/);
  if (!code) return ctx.reply(`❌ Usage : ${config.prefix}join https://chat.whatsapp.com/XXX`);
  try {
    await ctx.sock.groupAcceptInvite(code[1]);
    await ctx.reply('✅ Groupe rejoint.');
  } catch (e) {
    await ctx.reply(`❌ Impossible : ${e.message}`);
  }
});
};
module.exports.maison = true;
