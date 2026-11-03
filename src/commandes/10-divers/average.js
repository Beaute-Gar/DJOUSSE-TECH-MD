// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":11,"entryOrder":400}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['average', 'avg'],
  description: "Calculate average",
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const numbers = args.map(Number).filter(number => !Number.isNaN(number));
    if (!numbers.length) {
      return ctx.reply(style.renderError(['Usage: .average 10 20 30']));
    }
    const average = numbers.reduce((sum, number) => sum + number, 0) / numbers.length;
    return ctx.reply(style.renderInfo([
      `📊 Average of [${numbers.join(', ')}] = *${average.toFixed(2)}*`,
    ]));
  },
};
