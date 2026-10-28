'use strict';

module.exports = function enregistrer(env) {
  const { cmd, history } = env;
cmd('derniers', ['historique'], { cat: 9, desc: 'Mémoire : derniers messages du chat', usage: 'derniers [1-10]', owner: true }, async (ctx) => {
  const arr = history.get(ctx.from) || [];
  if (!arr.length) return ctx.reply('📭 Aucun message en mémoire pour ce chat.');
  const n = Math.max(1, Math.min(parseInt(ctx.args[0], 10) || 10, 10));
  const lines = arr.slice(-n).map((e, i) =>
    `${i + 1}. [${new Date(e.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}] +${e.s} : ${e.t}`
  );
  await ctx.reply(`🧠 *Mémoire — ${arr.length} message(s)*\n${lines.join('\n')}`);
});
};
module.exports.maison = true;
