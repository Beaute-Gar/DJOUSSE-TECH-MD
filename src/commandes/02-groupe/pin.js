'use strict';

module.exports = function enregistrer(env) {
  const { cmd, quotedKey, send } = env;
cmd('pin', { cat: 2, desc: 'Épingler un message (24h)', usage: 'pin (répondre au message)', group: true, admin: true, botAdmin: true, icon: '📌' }, async (ctx) => {
  const key = quotedKey(ctx.msg, ctx.content);
  if (!key) return ctx.reply(`❌ Réponds au message à épingler.`);
  try {
    await send(ctx.sock, ctx.from, { pin: { type: 1, time: 86400, key } });
    await ctx.success(['MESSAGE ÉPINGLÉ 24H']);
  } catch (e) {
    await ctx.reply(`❌ Pin impossible : ${e.message}`);
  }
});
};
module.exports.maison = true;
