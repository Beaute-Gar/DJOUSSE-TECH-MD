// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":13,"entryOrder":402}
'use strict';

const style = require('../../config/style');

function gcd(left, right) {
  return right ? gcd(right, left % right) : left;
}

module.exports = {
  commands: ['gcd', 'hcf'],
  description: 'Greatest common divisor',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const numbers = args.map(Number).filter(number => !Number.isNaN(number) && number > 0);
    if (numbers.length < 2) {
      return ctx.reply(style.renderError(['Usage: .gcd 12 18']));
    }

    return ctx.reply(style.renderInfo([
      `GCD(${numbers.join(', ')}) = ${numbers.reduce(gcd)}`,
    ]));
  },
};
