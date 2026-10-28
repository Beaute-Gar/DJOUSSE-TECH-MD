'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config } = env;
cmd('unblock', { cat: 9, desc: 'Débloquer un numéro', usage: 'unblock <numéro>', owner: true }, async (ctx) => {
  const raw = (ctx.q || '').match(/\d{5,}/);
  if (!raw) return ctx.reply(`❌ Usage : ${config.prefix}unblock 237690000000`);
  const jid = `${raw[0]}@s.whatsapp.net`;
  await ctx.sock.updateBlockStatus(jid, 'unblock');
  await ctx.reply(`✅ +${raw[0]} débloqué.`);
});
};
module.exports.maison = true;
