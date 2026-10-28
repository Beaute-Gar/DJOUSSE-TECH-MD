'use strict';

module.exports = function enregistrer(env) {
  const { auth, ciblesAccept, cmd, config } = env;
cmd('unaccept', ['deaccept'], {
  cat: 9, desc: "Retirer un accès accordé par .accept",
  usage: 'unaccept @user|numéro', owner: true, icon: '⛔',
}, async (ctx) => {
  const cibles = ciblesAccept(ctx);
  if (!cibles.length) return ctx.error(['AUCUN DESTINATAIRE', `UTILISATION : ${config.prefix}UNACCEPT @USER`]);
  const lignes = cibles.map((n) => (auth.unaccept(n).ok ? `⛔ +${n} — ACCÈS RETIRÉ` : `ℹ️ +${n} — PAS DANS LA LISTE`));
  return ctx.success(['ACCÈS RÉVOQUÉ', ...lignes]);
});
};
module.exports.maison = true;
