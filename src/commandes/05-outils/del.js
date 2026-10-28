'use strict';

module.exports = function enregistrer(env) {
  const { cmd, quotedKey, send } = env;
cmd('del', ['delete'], {
  cat: 5, desc: 'Supprimer un message (pour tous si admin/bot)', usage: 'del (répondre au message)', icon: '🗑️',
}, async (ctx) => {
  const key = quotedKey(ctx.msg, ctx.content);
  if (!key) return ctx.reply(`❌ Réponds au message à supprimer.`);
  try {
    await send(ctx.sock, ctx.from, { delete: key });
    await ctx.react('✅');
  } catch (e) {
    await ctx.reply(`❌ Suppression impossible : ${e.message}`);
  }
});
};
module.exports.maison = true;
