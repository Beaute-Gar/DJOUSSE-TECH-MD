// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":1,"entryOrder":390}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['subtract', 'sub'],
  description: 'Subtract numbers',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const numbers = args.map(Number).filter(number => !Number.isNaN(number));
    if (numbers.length < 2) {
      return ctx.reply(style.renderError(['Usage: .subtract 20 5']));
    }

    const result = numbers.reduce((difference, number) => difference - number);
    return ctx.reply(style.renderInfo([`➖ ${numbers.join(' - ')} = ${result}`]));
  },
};
