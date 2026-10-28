'use strict';

module.exports = function enregistrer(env) {
  const { cmd, participantsUpdate } = env;
cmd('demote', ['removeadmin'], { cat: 2, desc: 'Retirer le statut admin', usage: 'demote @user', group: true, admin: true, botAdmin: true }, async (ctx) => participantsUpdate(ctx, 'demote', 'demote'));
};
module.exports.maison = true;
