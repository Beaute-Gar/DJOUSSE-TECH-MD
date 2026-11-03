// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":18,"entryOrder":407}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['tipcalc'],
  description: "Tip calculator",
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const [bill, percentage] = args.map(Number);
    if (Number.isNaN(bill)) {
      return ctx.reply(style.renderError(['Usage: .tip <bill> [percent]']));
    }
    const tipPercentage = percentage || 15;
    const tip = bill * tipPercentage / 100;
    return ctx.reply(style.renderInfo([
      '💰 *Tip Calculator*',
      '',
      `Bill: $${bill.toFixed(2)}`,
      `Tip (${tipPercentage}%): $${tip.toFixed(2)}`,
      `Total: *$${(bill + tip).toFixed(2)}*`,
    ]));
  },
};
