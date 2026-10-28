'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, isPrimaryOwner, isSudoNumber, num, saveState, state } = env;
cmd('claim', ['claimsudo'], {
  cat: 1, desc: 'Activer un accès sudo avec un code', usage: 'claim <CODE>', icon: '🎫',
}, async (ctx) => {
  const code = (ctx.args[0] || ctx.q || '').trim().toUpperCase();
  if (!code) return ctx.error(['USAGE', `${config.prefix}CLAIM ABC123`]);
  state.settings.authCodes = state.settings.authCodes || {};
  const entry = state.settings.authCodes[code];
  if (!entry || entry.exp < Date.now()) {
    delete state.settings.authCodes[code];
    saveState();
    return ctx.error(['CODE INVALIDE OU EXPIRÉ']);
  }
  const n = num(ctx.sender);
  if (!n) return ctx.error(['NUMÉRO INTROUVABLE']);
  if (isPrimaryOwner(n) || isSudoNumber(n)) {
    delete state.settings.authCodes[code];
    saveState();
    return ctx.success(['TU ES DÉJÀ AUTORISÉ']);
  }
  state.settings.sudo = state.settings.sudo || [];
  if (!state.settings.sudo.includes(n)) state.settings.sudo.push(n);
  delete state.settings.authCodes[code];
  saveState();
  await ctx.success([
    'ACCÈS SUDO ACTIVÉ',
    `+${n}`,
    'COMMANDES OWNER / MENU OWNER VISIBLES',
  ]);
});
};
module.exports.maison = true;
