// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":21,"entryOrder":410}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['compound', 'interest'],
  description: 'Compound interest',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const [principal, rate, years] = args.map(Number);
    if ([principal, rate, years].some(Number.isNaN)) {
      return ctx.reply(style.renderError([
        'Usage: .compound <principal> <rate%> <years>',
      ]));
    }

    const amount = principal * Math.pow(1 + rate / 100, years);
    return ctx.reply(style.renderInfo([
      '💰 Compound Interest',
      `Principal: $${principal}`,
      `Rate: ${rate}%/yr`,
      `Years: ${years}`,
      `Final: $${amount.toFixed(2)}`,
      `Profit: $${(amount - principal).toFixed(2)}`,
    ]));
  },
};
