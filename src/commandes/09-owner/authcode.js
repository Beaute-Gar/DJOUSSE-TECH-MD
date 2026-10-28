'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, isPrimaryOwner, num, saveState, state } = env;
cmd('authcode', ['codeauth'], {
  cat: 9, desc: 'Générer un code pour activer un sudo', usage: 'authcode', owner: true, icon: '🎫',
}, async (ctx) => {
  // Seul un owner PRINCIPAL (pas sudo) peut générer — sécurité
  const me = num(ctx.sender);
  if (!isPrimaryOwner(me) && !ctx.isBotSelf) {
    return ctx.error(['RÉSERVÉ AUX OWNERS PRINCIPAUX', 'PAS AUX SUDO']);
  }
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  state.settings.authCodes = state.settings.authCodes || {};
  // purge codes > 1h
  const now = Date.now();
  for (const [k, v] of Object.entries(state.settings.authCodes)) {
    if (!v?.exp || v.exp < now) delete state.settings.authCodes[k];
  }
  state.settings.authCodes[code] = { exp: now + 60 * 60 * 1000, by: me };
  saveState();
  await ctx.success([
    'CODE CRÉÉ (1 HEURE)',
    code,
    `L’AUTRE PERSONNE TAPE : ${config.prefix}CLAIM ${code}`,
  ]);
});
};
module.exports.maison = true;
