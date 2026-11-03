// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":8,"entryOrder":397}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['prime', 'isprime'],
  description: 'Check if prime',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const number = Number.parseInt(args[0], 10);
    if (Number.isNaN(number) || number < 2) {
      return ctx.reply(style.renderError(['Usage: .prime <number>']));
    }

    let isPrime = true;
    for (let divisor = 2; divisor <= Math.sqrt(number); divisor += 1) {
      if (number % divisor === 0) {
        isPrime = false;
        break;
      }
    }

    return ctx.reply(style.renderInfo([
      `${number} is ${isPrime ? '✅ prime' : '❌ not prime'}`,
    ]));
  },
};
