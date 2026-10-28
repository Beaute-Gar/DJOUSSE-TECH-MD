'use strict';

module.exports = function enregistrer(env) {
  const { buildFrame, bullet, cmd, formatDuration } = env;
cmd('uptime', { cat: 1, desc: 'Temps de fonctionnement', icon: '⏱️' }, async (ctx) => {
  await ctx.reply(buildFrame('UPTIME', [
    bullet('EN LIGNE DEPUIS', formatDuration(process.uptime() * 1000)),
  ]));
});
};
module.exports.maison = true;
