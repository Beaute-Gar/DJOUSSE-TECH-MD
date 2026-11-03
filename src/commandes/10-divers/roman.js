'use strict';
// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":19,"entryOrder":408}

const style = require('../../config/style');

module.exports = {
  commands: ['roman', 'toroman'],
  description: 'Convert to Roman numerals',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const number = Number.parseInt(args[0], 10);
    if (Number.isNaN(number) || number < 1 || number > 3999) {
      return ctx.reply(style.renderError(['Usage: .roman <1-3999>']));
    }

    const values = [
      [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
      [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
      [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
    ];
    let remaining = number;
    let result = '';
    for (const [value, numeral] of values) {
      while (remaining >= value) {
        result += numeral;
        remaining -= value;
      }
    }

    return ctx.reply(style.renderInfo([`🏛️ ${number} = *${result}*`]));
  },
};
