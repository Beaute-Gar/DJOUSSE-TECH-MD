'use strict';

module.exports = function enregistrer(env) {
  const { MSG_NO_KEY, aiUserMessage, askAI, cmd, config, ctxInfo, hasAIKey, textOf, unwrap } = env;
cmd('summarize', ['resume'], { cat: 6, desc: 'Résumer un texte cité', usage: 'summarize (réponds à un texte)' }, async (ctx) => {
  const ci = ctxInfo(ctx.content);
  const quoted = ci?.quotedMessage ? textOf(unwrap(ci.quotedMessage)) : '';
  const source = quoted || ctx.q;
  if (!source) return ctx.reply(`❌ Réponds à un texte.\nUsage : ${config.prefix}summarize`);
  if (!hasAIKey()) return ctx.reply(MSG_NO_KEY);
  await ctx.reply(config.messages.wait);
  try {
    const answer = await askAI(`Résume ce texte en 5 points maximum, en français :\n\n${source.slice(0, 3000)}`);
    await ctx.reply(`📋 *Résumé*\n\n${answer.slice(0, 3500)}`);
  } catch (e) {
    await ctx.reply(aiUserMessage(e));
  }
});
};
module.exports.maison = true;
