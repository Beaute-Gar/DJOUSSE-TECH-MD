'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, send } = env;
cmd('poll', ['sondage'], { cat: 2, desc: 'Créer un sondage', usage: 'poll Question | option1 | option2', group: true }, async (ctx) => {
  const parts = ctx.q.split('|').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3) {
    return ctx.reply(`❌ Usage : ${config.prefix}poll Préfères-tu la plage ? | Oui | Non`);
  }
  const question = parts[0].slice(0, 200);
  const values = parts.slice(1, 11).map((v) => v.slice(0, 80));
  await send(ctx.sock, ctx.from, {
    poll: { name: question, values, selectableCount: 1 },
  });
});
};
module.exports.maison = true;
