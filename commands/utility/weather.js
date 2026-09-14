const api = require('../../utils/api');

module.exports = {
  name: 'weather',
  aliases: ['weather', 'meteo'],
  category: 'utility',
  desc: 'Météo d\'une ville',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    if (!args.length) return ctx.reply('Écris le nom de la ville.');
    const city = args.join(' ');
    try {
      await ctx.react('🌤️');
      const data = await api.getWeather(city);
      if (!data) return ctx.reply('Ville introuvable...');
      const info = `Météo à ${data.city || city}\n\n🌡️ Température: ${data.temperature || 'N/A'}\n💧 Humidité: ${data.humidity || 'N/A'}\n💨 Vent: ${data.wind || 'N/A'}\n☁️ Conditions: ${data.conditions || 'N/A'}`;
      ctx.reply(info);
    } catch (e) {
      ctx.reply('Erreur lors de la récupération de la météo...');
    }
  }
};
