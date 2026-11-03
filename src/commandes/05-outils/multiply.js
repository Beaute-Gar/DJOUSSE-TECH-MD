// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":2,"entryOrder":391}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['multiply', 'mul'],
  description: 'Multiply numbers',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const numbers = args.map(Number).filter(number => !Number.isNaN(number));
    if (!numbers.length) {
      return ctx.reply(style.renderError(['Usage: .multiply 5 10']));
    }

    const product = numbers.reduce((result, number) => result * number, 1);
    return ctx.reply(style.renderInfo([`✖️ ${numbers.join(' × ')} = ${product}`]));
  },
};
