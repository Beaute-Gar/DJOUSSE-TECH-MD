'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config } = env;
cmd('binary', { cat: 5, desc: 'Encoder/décoder binaire', usage: 'binary [decode] <texte>' }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}binary Bonjour`);
  const isDecode = /^decode$/i.test(ctx.args[0] || '');
  const payload = isDecode ? ctx.args.slice(1).join(' ') : ctx.q;
  try {
    const out = isDecode
      ? payload.trim().split(/\s+/).map((b) => String.fromCharCode(parseInt(b, 2))).join('')
      : Buffer.from(payload, 'utf8').toString('binary').split('').map((c) => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
    await ctx.reply(out || '❌ Résultat vide.');
  } catch (e) {
    await ctx.reply('❌ Opération invalide.');
  }
});
};
module.exports.maison = true;
