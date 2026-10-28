'use strict';

module.exports = function enregistrer(env) {
  const { auth, cmd, config } = env;
cmd('accepted', ['acceptes'], {
  cat: 9, desc: 'Liste des utilisateurs acceptés',
  usage: 'accepted', owner: true, icon: '📋',
}, async (ctx) => {
  const list = auth.listAccepted();
  if (!list.length) return ctx.success(['AUCUN UTILISATEUR ACCEPTÉ', `OUVRIR : ${config.prefix}ACCEPT @USER`]);
  const lignes = list.map((e) => (e.until
    ? `✅ +${e.n} — jusqu’au ${new Date(e.until).toLocaleString('fr-FR')}`
    : `✅ +${e.n} — permanent`));
  return ctx.success(['UTILISATEURS ACCEPTÉS', ...lignes]);
});
};
module.exports.maison = true;
