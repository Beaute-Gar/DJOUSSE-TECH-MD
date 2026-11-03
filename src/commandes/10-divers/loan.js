// @legacy-order {"sourceFile":"10-divers/crypto-finance.js","sourceOrder":65,"definitionIndex":2,"entryOrder":116}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['loan', 'loancalc'],
  description: 'Loan calculator',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const [principal, rate, years] = args.map(Number);
    if ([principal, rate, years].some(Number.isNaN)) {
      return ctx.reply(style.renderError(['Usage: .loan <amount> <annual_rate%> <years>']));
    }

    const monthlyRate = rate / 100 / 12;
    const months = years * 12;
    const monthly = principal * (monthlyRate * Math.pow(1 + monthlyRate, months))
      / (Math.pow(1 + monthlyRate, months) - 1);
    const totalPaid = monthly * months;
    return ctx.reply(style.renderInfo([
      'Loan Calculator',
      '',
      `Principal: $${principal.toLocaleString()}`,
      `Rate: ${rate}%/year`,
      `Term: ${years} years`,
      '',
      `Monthly: $${monthly.toFixed(2)}`,
      `Total Paid: $${totalPaid.toFixed(2)}`,
      `Total Interest: $${(totalPaid - principal).toFixed(2)}`,
    ]));
  },
};
