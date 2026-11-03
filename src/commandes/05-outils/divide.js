// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":3,"entryOrder":392}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['divide', 'div'],
  description: 'Divide numbers',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const numbers = args.map(Number).filter(number => !Number.isNaN(number));
    if (numbers.length < 2) {
      return ctx.reply(style.renderError(['Usage: .divide 100 5']));
    }
    if (numbers[1] === 0) {
      return ctx.reply(style.renderError(['Cannot divide by zero']));
    }

    return ctx.reply(style.renderInfo([
      `➗ ${numbers[0]} ÷ ${numbers[1]} = ${numbers[0] / numbers[1]}`,
    ]));
  },
};
