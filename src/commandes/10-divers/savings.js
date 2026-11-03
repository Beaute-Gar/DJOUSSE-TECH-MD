// @legacy-order {"sourceFile":"10-divers/crypto-finance.js","sourceOrder":65,"definitionIndex":3,"entryOrder":117}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['savings', 'savingscalc'],
  description: 'Savings calculator',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const [monthly, rate, years] = args.map(Number);
    if ([monthly, rate, years].some(Number.isNaN)) {
      return ctx.reply(style.renderError(['Usage: .savings <monthly_amount> <annual_rate%> <years>']));
    }

    const monthlyRate = rate / 100 / 12;
    const months = years * 12;
    const futureValue = monthlyRate === 0
      ? monthly * months
      : monthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    const contributed = monthly * months;
    return ctx.reply(style.renderInfo([
      'Savings Calculator',
      '',
      `Monthly: $${monthly}`,
      `Rate: ${rate}%/year`,
      `Period: ${years} years`,
      '',
      `Contributed: $${contributed.toLocaleString()}`,
      `Interest Earned: $${(futureValue - contributed).toFixed(2)}`,
      `Total Savings: $${futureValue.toFixed(2)}`,
    ]));
  },
};
