'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, quotedKey, send } = env;
cmd('edit', { cat: 5, desc: 'Modifier un message envoyé par le bot', usage: 'edit <nouveau texte> (répondre au message)', icon: '✏️' }, async (ctx) => {
  const key = quotedKey(ctx.msg, ctx.content);
  if (!key) return ctx.reply(`❌ Réponds à un message du bot puis : ${config.prefix}edit nouveau texte`);
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}edit <nouveau texte>`);
  try {
    await send(ctx.sock, ctx.from, { text: ctx.q.slice(0, 4000), edit: key });
    await ctx.react('✅');
  } catch (e) {
    await ctx.reply(`❌ Impossible de modifier : ${e.message}`);
  }
});
};
module.exports.maison = true;
