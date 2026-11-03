// @legacy-order {"sourceFile":"10-divers/crypto-finance.js","sourceOrder":65,"definitionIndex":8,"entryOrder":122}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['discount', 'sale'],
  description: 'Discount calculator',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const [price, discount] = args.map(Number);
    if (Number.isNaN(price) || Number.isNaN(discount)) {
      return ctx.reply(style.renderError(['Usage: .discount <price> <discount%>']));
    }

    const saved = price * discount / 100;
    return ctx.reply(style.renderInfo([
      'Discount Calculator',
      '',
      `Original: $${price.toFixed(2)}`,
      `Discount: ${discount}%`,
      `You Save: $${saved.toFixed(2)}`,
      `Final Price: $${(price - saved).toFixed(2)}`,
    ]));
  },
};
