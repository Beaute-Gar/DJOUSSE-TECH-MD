'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config } = env;
cmd('block', { cat: 9, desc: 'Bloquer un numéro', usage: 'block <numéro>', owner: true }, async (ctx) => {
  const raw = (ctx.q || '').match(/\d{5,}/);
  if (!raw) return ctx.reply(`❌ Usage : ${config.prefix}block 237690000000`);
  const jid = `${raw[0]}@s.whatsapp.net`;
  await ctx.sock.updateBlockStatus(jid, 'block');
  await ctx.reply(`🚫 +${raw[0]} bloqué.`);
});
};
module.exports.maison = true;
