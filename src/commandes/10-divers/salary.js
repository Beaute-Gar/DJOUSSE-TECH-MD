// @legacy-order {"sourceFile":"10-divers/crypto-finance.js","sourceOrder":65,"definitionIndex":7,"entryOrder":121}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['salary', 'salarycalc'],
  description: 'Salary breakdown',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const annual = parseFloat(args[0]);
    if (Number.isNaN(annual)) {
      return ctx.reply(style.renderError(['Usage: .salary <annual_salary>']));
    }

    return ctx.reply(style.renderInfo([
      'Salary Breakdown',
      '',
      `Annual: $${annual.toLocaleString()}`,
      `Monthly: $${(annual / 12).toFixed(2)}`,
      `Bi-weekly: $${(annual / 26).toFixed(2)}`,
      `Weekly: $${(annual / 52).toFixed(2)}`,
      `Daily: $${(annual / 365).toFixed(2)}`,
      `Hourly (40h/wk): $${(annual / 2080).toFixed(2)}`,
    ]));
  },
};
