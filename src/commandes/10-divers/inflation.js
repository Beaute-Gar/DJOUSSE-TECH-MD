// @legacy-order {"sourceFile":"10-divers/crypto-finance.js","sourceOrder":65,"definitionIndex":5,"entryOrder":119}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['inflation', 'inflationcalc'],
  description: 'Inflation calculator',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const [amount, rate, years] = args.map(Number);
    if ([amount, rate, years].some(Number.isNaN)) {
      return ctx.reply(style.renderError(['Usage: .inflation <amount> <annual_rate%> <years>']));
    }

    const future = amount * Math.pow(1 + rate / 100, years);
    const purchasing = amount / Math.pow(1 + rate / 100, years);
    return ctx.reply(style.renderInfo([
      'Inflation Calculator',
      '',
      `Current Amount: $${amount}`,
      `Inflation Rate: ${rate}%/year`,
      `Years: ${years}`,
      '',
      `Future Cost: $${future.toFixed(2)}`,
      `Purchasing Power: $${purchasing.toFixed(2)}`,
      '',
      `$${amount} today will feel like $${purchasing.toFixed(2)} in ${years} years.`,
    ]));
  },
};
