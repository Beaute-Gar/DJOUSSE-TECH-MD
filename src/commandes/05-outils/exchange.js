// @legacy-order {"sourceFile":"05-outils/education.js","sourceOrder":81,"definitionIndex":9,"entryOrder":159}
'use strict';

const style = require('../../config/style');

const currencies = {
  USD: { name: 'US Dollar', symbol: '$' },
  EUR: { name: 'Euro', symbol: '€' },
  GBP: { name: 'British Pound', symbol: '£' },
  JPY: { name: 'Japanese Yen', symbol: '¥' },
  KES: { name: 'Kenyan Shilling', symbol: 'KSh' },
  NGN: { name: 'Nigerian Naira', symbol: '₦' },
  ZAR: { name: 'South African Rand', symbol: 'R' },
  INR: { name: 'Indian Rupee', symbol: '₹' },
  CNY: { name: 'Chinese Yuan', symbol: '¥' },
  AUD: { name: 'Australian Dollar', symbol: 'A$' },
  CAD: { name: 'Canadian Dollar', symbol: 'C$' },
  CHF: { name: 'Swiss Franc', symbol: 'CHF' },
  BRL: { name: 'Brazilian Real', symbol: 'R$' },
  RUB: { name: 'Russian Ruble', symbol: '₽' },
  AED: { name: 'UAE Dirham', symbol: 'د.إ' },
  TZS: { name: 'Tanzanian Shilling', symbol: 'TSh' },
  UGX: { name: 'Ugandan Shilling', symbol: 'USh' },
  GHS: { name: 'Ghanaian Cedi', symbol: 'GH₵' },
  EGP: { name: 'Egyptian Pound', symbol: 'E£' },
  ETB: { name: 'Ethiopian Birr', symbol: 'Br' },
};

module.exports = {
  commands: ['exchange', 'forex'],
  description: 'Currency info',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const code = (args[0] || '').toUpperCase();
    if (!code) {
      return ctx.reply(style.renderError([
        'Usage: .currency <code>',
        'Examples: USD, EUR, KES, NGN',
      ]));
    }

    const currency = currencies[code];
    if (!currency) {
      return ctx.reply(style.renderError(['Unknown currency code']));
    }

    return ctx.reply(style.renderInfo([
      `💱 ${currency.name}`,
      `Code: ${code}`,
      `Symbol: ${currency.symbol}`,
    ]));
  },
};
