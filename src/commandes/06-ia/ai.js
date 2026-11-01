'use strict';

module.exports = function enregistrer(env) {
  const { MSG_NO_KEY, aiUserMessage, askAI, cmd, config, ctxInfo, hasAIKey, history, textOf, unwrap } = env;
cmd('ai', ['gemini'], { cat: 6, desc: 'Pose une question à l’IA', usage: 'ai <question>' }, async (ctx) => {
  let prompt = ctx.q;
  if (!prompt) {
    const ci = ctxInfo(ctx.content);
    if (ci?.quotedMessage) prompt = textOf(unwrap(ci.quotedMessage));
  }
  if (!prompt) return ctx.reply(`❌ Usage : ${config.prefix}ai Comment aller-tu ?`);
  if (!hasAIKey()) return ctx.reply(MSG_NO_KEY);
  await ctx.reply(config.messages.wait);
  try {
    /* Contexte : 5 derniers messages du chat (mémoire persistante) */
    const mem = (history.get(ctx.from) || []).slice(-5);
    const block = mem.length
      ? `Conversation récente :\n${mem.map((e) => `+${e.s}: ${e.t}`).join('\n')}\n\nQuestion : `
      : '';
    const answer = await askAI((block + prompt).slice(0, 2500));
    await ctx.reply(answer.slice(0, 4000));
  } catch (e) {
    await ctx.reply(aiUserMessage(e));
  }
});
};
module.exports.maison = true;
