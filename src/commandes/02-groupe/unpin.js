'use strict';

module.exports = function enregistrer(env) {
  const { cmd, quotedKey, send } = env;
cmd('unpin', { cat: 2, desc: 'Désépingler un message', usage: 'unpin (répondre au message)', group: true, admin: true, botAdmin: true, icon: '📍' }, async (ctx) => {
  const key = quotedKey(ctx.msg, ctx.content);
  if (!key) return ctx.reply(`❌ Réponds au message à désépingler.`);
  try {
    await send(ctx.sock, ctx.from, { pin: { type: 0, time: 0, key } });
    await ctx.success(['MESSAGE DÉSÉPINGLÉ']);
  } catch (e) {
    await ctx.reply(`❌ Unpin impossible : ${e.message}`);
  }
});
};
module.exports.maison = true;
