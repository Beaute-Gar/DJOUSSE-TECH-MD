// @legacy-order {"sourceFile":"10-divers/crypto-finance.js","sourceOrder":65,"definitionIndex":4,"entryOrder":118}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['tax', 'taxcalc'],
  description: 'Simple tax calculator',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const income = parseFloat(args[0]);
    const rate = parseFloat(args[1]) || 30;
    if (Number.isNaN(income)) {
      return ctx.reply(style.renderError(['Usage: .tax <income> [tax_rate%]']));
    }

    const tax = income * rate / 100;
    return ctx.reply(style.renderInfo([
      'Tax Calculator',
      '',
      `Gross Income: $${income.toLocaleString()}`,
      `Tax Rate: ${rate}%`,
      `Tax Amount: $${tax.toFixed(2)}`,
      `Net Income: $${(income - tax).toFixed(2)}`,
    ]));
  },
};
