// @legacy-order {"sourceFile":"10-divers/crypto-finance.js","sourceOrder":65,"definitionIndex":9,"entryOrder":123}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['networth', 'nwcalc'],
  description: 'Net worth calculator',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const assets = parseFloat(args[0]);
    const debts = parseFloat(args[1]);
    if (Number.isNaN(assets) || Number.isNaN(debts)) {
      return ctx.reply(style.renderError(['Usage: .networth <total_assets> <total_debts>']));
    }

    const netWorth = assets - debts;
    return ctx.reply(style.renderInfo([
      'Net Worth Calculator',
      '',
      `Assets: $${assets.toLocaleString()}`,
      `Debts: $${debts.toLocaleString()}`,
      '',
      `Net Worth: $${netWorth.toLocaleString()}`,
      netWorth > 0 ? 'Positive! Keep it up!' : 'Negative. Focus on reducing debt.',
    ]));
  },
};
