'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, saveState, state } = env;
cmd('autonce', ['autoonce'], {
  cat: 4, desc: 'Sauvegarde auto des vue uniques',
  usage: 'autonce on|off', icon: '📥',
}, async (ctx) => {
  const arg = (ctx.args[0] || '').toLowerCase();
  if (!['on', 'off', 'true', 'false'].includes(arg)) {
    return ctx.saisie(`POUR COMPLÉTER : ${config.prefix}AUTONCE ON|OFF`);
  }
  const on = ['on', 'true'].includes(arg);
  state.once = state.once || {};
  if (on) state.once[ctx.from] = true;
  else delete state.once[ctx.from];
  saveState();
  await ctx.success(on
    ? ['AUTO-SAUVEGARDE VUE UNIQUE ACTIVÉE', 'LES MÉDIAS VUE UNIQUE REÇUS ICI', 'TOMBERONT EN PRIVÉ CHEZ LE PROPRIÉTAIRE']
    : ['AUTO-SAUVEGARDE VUE UNIQUE DÉSACTIVÉE']);
});
};
module.exports.maison = true;
