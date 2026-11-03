// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":0,"entryOrder":389}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['sum', 'plus'],
  description: 'Add numbers',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const numbers = args.map(Number).filter(number => !Number.isNaN(number));
    if (!numbers.length) {
      return ctx.reply(style.renderError(['Usage: .add 5 10 15']));
    }

    const total = numbers.reduce((sum, number) => sum + number, 0);
    return ctx.reply(style.renderInfo([`➕ ${numbers.join(' + ')} = ${total}`]));
  },
};
