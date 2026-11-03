'use strict';

const axios = require('axios');
const style = require('../../config/style');

module.exports = {
  commands: ['currency'],
  description: 'Convert between currencies',
  usage: '.currency <amount> <FROM> <TO>',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const amount = Number(args[0]);
    const from = String(args[1] || '').toUpperCase();
    const to = String(args[2] || '').toUpperCase();
    if (args.length < 3 || !Number.isFinite(amount) || amount <= 0
      || !/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
      return ctx.reply(style.renderError([
        'Usage : .currency <montant> <DEVISE> <DEVISE>',
        'Exemple : .currency 100 USD KES',
      ]));
    }

    try {
      const { data } = await axios.get('https://api.frankfurter.app/latest', {
        params: { amount, from, to },
        timeout: 8000,
      });
      const converted = data.rates?.[to];
      if (!Number.isFinite(converted)) {
        return ctx.reply(style.renderError([`Conversion indisponible pour ${from} → ${to}.`]));
      }

      return ctx.reply(style.renderInfo([
        'Currency Conversion',
        '',
        `${amount.toLocaleString()} ${from} → ${converted.toLocaleString()} ${to}`,
        '',
        `Rate as of ${data.date || 'N/A'}`,
      ]));
    } catch (error) {
      console.warn('[CURRENCY] conversion failed:', error.message);
      return ctx.reply(style.renderError(['La conversion a échoué. Vérifie les codes de devise ou réessaie plus tard.']));
    }
  },
};
