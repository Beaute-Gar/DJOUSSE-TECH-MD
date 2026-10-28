'use strict';

module.exports = function enregistrer(env) {
  const { cmd, participantsUpdate } = env;
cmd('kick', ['remove'], { cat: 2, desc: 'Expulser un membre', usage: 'kick @user', group: true, admin: true, botAdmin: true }, async (ctx) => participantsUpdate(ctx, 'kick', 'remove'));
};
module.exports.maison = true;
