'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, quotedKey, send } = env;
cmd('react', {
  cat: 5, desc: 'Réagir à un message', usage: 'react 🔥 (répondre au message)', icon: '👍',
}, async (ctx) => {
  const key = quotedKey(ctx.msg, ctx.content);
  if (!key) return ctx.reply(`❌ Réponds au message puis : ${config.prefix}react 🔥`);
  const emoji = (ctx.args[0] || config.likeEmoji || '👍').slice(0, 8);
  try {
    await send(ctx.sock, ctx.from, { react: { text: emoji, key } });
  } catch (e) {
    await ctx.reply(`❌ Réaction impossible : ${e.message}`);
  }
});
};
module.exports.maison = true;
