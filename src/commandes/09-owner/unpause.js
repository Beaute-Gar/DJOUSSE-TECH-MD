'use strict';

module.exports = function enregistrer(env) {
  const { cmd, conflict } = env;
cmd('unpause', ['reprendre'], {
  cat: 9, desc: 'Reprendre un chat mis en pause (conflit bot↔bot)',
  usage: 'unpause · unpause all', owner: true, icon: '▶️',
}, async (ctx) => {
  const a = (ctx.args[0] || '').toLowerCase();
  if (['all', 'tous', 'tout'].includes(a)) {
    const liste = conflict.status();
    let n = 0;
    for (const c of liste) if (conflict.resume(c.chat)) n += 1;
    return ctx.success(['PAUSES LEVÉES', `${n} CHAT(S) REPRISENT`]);
  }
  if (conflict.resume(ctx.from)) return ctx.success(['REPRISE', 'LES RÉPONSES SONT DE NOUVEAU ACTIVES']);
  return ctx.error(['AUCUNE PAUSE ICI', 'CE CHAT N’EST PAS EN CONFLIT']);
});
};
module.exports.maison = true;
