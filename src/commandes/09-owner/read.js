'use strict';

module.exports = function enregistrer(env) {
  const { cmd, quotedKey } = env;
cmd('read', ['markread'], {
  cat: 9, desc: 'Marquer le message cité comme lu', usage: 'read (répondre)', owner: true, icon: '👁️',
}, async (ctx) => {
  const key = quotedKey(ctx.msg, ctx.content) || ctx.msg.key;
  try {
    await ctx.sock.readMessages([key]);
    await ctx.success(['MARQUÉ COMME LU']);
  } catch (e) {
    await ctx.reply(`❌ read impossible : ${e.message}`);
  }
});
};
module.exports.maison = true;
