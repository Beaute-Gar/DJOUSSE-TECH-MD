'use strict';

module.exports = function enregistrer(env) {
  const { buildFrame, bullet, cmd, formatDuration, toUnicode } = env;
cmd('ping', { cat: 1, desc: 'Latence du bot', icon: '🏓' }, async (ctx) => {
  const latency = ctx.msg.messageTimestamp
    ? Date.now() - Number(ctx.msg.messageTimestamp) * 1000
    : 0;
  await ctx.reply(buildFrame('PING', [
    bullet('STATUT', `${toUnicode('ONLINE')} ✅`),
    bullet('LATENCE', `${Math.max(0, latency)} ms`),
    bullet('UPTIME', formatDuration(process.uptime() * 1000)),
    bullet('NODE', process.version),
  ]));
});
};
module.exports.maison = true;
