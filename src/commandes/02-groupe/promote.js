'use strict';

module.exports = function enregistrer(env) {
  const { cmd, participantsUpdate } = env;
cmd('promote', ['makeadmin', 'admin'], { cat: 2, desc: 'Promouvoir admin', usage: 'promote @user', group: true, admin: true, botAdmin: true }, async (ctx) => participantsUpdate(ctx, 'promote', 'promote'));
};
module.exports.maison = true;
