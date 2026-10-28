'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, ctxInfo, textOf, translate, unwrap } = env;
cmd('translate', ['tr'], { cat: 5, desc: 'Traduire un texte', usage: 'translate [langue] <texte>' }, async (ctx) => {
  let to = 'fr';
  let text = ctx.q;
  const first = (ctx.args[0] || '').toLowerCase();
  if (/^[a-z]{2}$/.test(first) && ctx.args.length > 1) {
    to = first;
    text = ctx.args.slice(1).join(' ');
  }
  if (!text) {
    const ci = ctxInfo(ctx.content);
    if (ci?.quotedMessage) text = textOf(unwrap(ci.quotedMessage));
  }
  if (!text) return ctx.reply(`❌ Usage : ${config.prefix}translate en Bonjour !`);
  try {
    const r = await translate(text.slice(0, 1500), { to });
    await ctx.reply(`🌐 *${r.from?.auto ? 'auto' : r.from?.language?.iso || '?'} → ${to}* :\n\n${r.text}`);
  } catch (e) {
    await ctx.reply(`❌ Traduction impossible : ${e.message}`);
  }
});
};
module.exports.maison = true;
