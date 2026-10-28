'use strict';

module.exports = function enregistrer(env) {
  const { auth, ciblesAccept, cmd, config, dureeAccept } = env;
cmd('accept', ['autoriser'], {
  cat: 9, desc: 'Autoriser des utilisateurs à utiliser le bot',
  usage: 'accept @user1 @user2 [30m|24h|7d|permanent]', owner: true, icon: '✅',
}, async (ctx) => {
  const cibles = ciblesAccept(ctx);
  if (!cibles.length) {
    return ctx.error([
      'AUCUN DESTINATAIRE',
      `MENTIONNE : ${config.prefix}ACCEPT @USER1 @USER2`,
      `OU NUMÉRO : ${config.prefix}ACCEPT 2376XXXXXXX 24H`,
    ]);
  }
  const ttl = dureeAccept(ctx);
  const lignes = [];
  for (const n of cibles) {
    const r = auth.accept(n, ttl);
    if (!r.ok) lignes.push(`⛔ +${n} — ${r.raison}`);
    else if (r.until) lignes.push(`✅ +${n} — JUSQU’À ${new Date(r.until).toLocaleString('fr-FR')}`);
    else lignes.push(`✅ +${n} — PERMANENT`);
  }
  return ctx.success(['UTILISATEUR(S) AUTORISÉ(S)', ...lignes]);
});
};
module.exports.maison = true;
