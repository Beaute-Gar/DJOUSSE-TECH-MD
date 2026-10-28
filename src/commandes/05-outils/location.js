'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, send } = env;
cmd('location', { cat: 5, desc: 'Envoyer un point GPS', usage: 'location <lat>, <lng> [nom]' }, async (ctx) => {
  const m = ctx.q.match(/(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/);
  if (!m) return ctx.reply(`❌ Usage : ${config.prefix}location 3.8480, 11.5020 Douala`);
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return ctx.reply('❌ Coordonnées invalides (latitude -90..90, longitude -180..180).');
  }
  const name = ctx.q.replace(m[0], '').trim().slice(0, 80);
  await send(ctx.sock, ctx.from, {
    location: { degreesLatitude: lat, degreesLongitude: lng, ...(name ? { name } : {}) },
  }, { quoted: ctx.msg });
});
};
module.exports.maison = true;
