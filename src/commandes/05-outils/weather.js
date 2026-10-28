'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, withNetworkTimeout } = env;
cmd('weather', ['meteo'], { cat: 5, desc: 'Météo d’une ville', usage: 'weather <ville>' }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}weather Douala`);
  try {
    const data = await withNetworkTimeout(async (signal) => {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(ctx.q.slice(0, 60))}?format=j1`, { signal });
      if (!res.ok) throw new Error(`wttr.in a répondu HTTP ${res.status}.`);
      return res.json();
    }, 15000, 'Météo');
    const c = data.current_condition?.[0];
    if (!c) throw new Error('ville introuvable');
    const area = data.nearest_area?.[0]?.areaName?.[0]?.value || ctx.q;
    await ctx.reply(
      `🌡️ *Météo — ${area}*\n` +
      `Température : ${c.temp_C}°C (ressenti ${c.FeelsLikeC}°C)\n` +
      `Humidité : ${c.humidity}%\n` +
      `Vent : ${c.windspeedKmph} km/h\n` +
      `État : ${c.weatherDesc?.[0]?.value || '?'}`
    );
  } catch (e) {
    await ctx.reply(`❌ Météo indisponible : ${e.message}`);
  }
});
};
module.exports.maison = true;
