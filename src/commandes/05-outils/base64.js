'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config } = env;
cmd('base64', { cat: 5, desc: 'Encoder/décoder base64', usage: 'base64 [decode] <texte>' }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}base64 Bonjour\nou ${config.prefix}base64 decode ...`);
  const isDecode = /^decode$/i.test(ctx.args[0] || '');
  const payload = isDecode ? ctx.args.slice(1).join(' ') : ctx.q;
  try {
    const out = isDecode
      ? Buffer.from(payload, 'base64').toString('utf8')
      : Buffer.from(payload, 'utf8').toString('base64');
    await ctx.reply(out);
  } catch (e) {
    await ctx.reply('❌ Opération invalide.');
  }
});
};
module.exports.maison = true;
