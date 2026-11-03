'use strict';

const axios = require('axios');
const config = require('../../config/config');
const style = require('../../config/style');

module.exports = {
  commands: ['climate', 'mosam'],
  description: 'Get current weather for a location',
  usage: '.climate <location>',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const location = args.join(' ').trim();
    if (!location) {
      return ctx.reply(style.renderError(['Indique une ville. Exemple : .climate Nairobi']));
    }
    if (!config.weatherApiKey) {
      return ctx.reply(style.renderError(['Service météo non configuré.', 'Ajoute OPENWEATHER_API_KEY dans le fichier .env.']));
    }

    try {
      const { data } = await axios.get(
        'https://api.openweathermap.org/data/2.5/weather',
        {
          params: { q: location, units: 'metric', appid: config.weatherApiKey },
          timeout: 10000,
        },
      );
      const weather = data.weather?.[0];
      if (!data.name || !data.main || !weather) {
        throw new Error('Weather service returned an invalid response.');
      }

      const description = String(weather.description || 'Conditions unavailable');
      const report = [
        `🌍 *${data.name}${data.sys?.country ? `, ${data.sys.country}` : ''} — Weather Report*`,
        `📅 ${new Date().toUTCString()}`,
        '',
        `🌡️ Temp: ${data.main.temp}°C (min ${data.main.temp_min}°C / max ${data.main.temp_max}°C)`,
        `💧 Humidity: ${data.main.humidity}%`,
        `💨 Wind: ${data.wind?.speed ?? 'N/A'} m/s`,
        `🌤️ ${description.charAt(0).toUpperCase()}${description.slice(1)}`,
        '',
        `_Powered by ${config.botName}_`,
      ].join('\n');
      await ctx.reply(style.renderInfo(report.split('\n')));
    } catch (error) {
      const notFound = error.response?.status === 404;
      if (!notFound) console.warn('[CLIMATE] lookup failed:', error.message);
      await ctx.reply(style.renderError([notFound
        ? 'Ville introuvable. Vérifie le nom et réessaie.'
        : 'Impossible de récupérer la météo pour le moment. Réessaie plus tard.']));
    }
  },
};
