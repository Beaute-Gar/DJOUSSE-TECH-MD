// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":14,"entryOrder":403}
'use strict';

const style = require('../../config/style');

function gcd(left, right) {
  return right ? gcd(right, left % right) : left;
}

function lcm(left, right) {
  return (left * right) / gcd(left, right);
}

module.exports = {
  commands: ['lcm'],
  description: 'Least common multiple',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const numbers = args.map(Number).filter(number => !Number.isNaN(number) && number > 0);
    if (numbers.length < 2) {
      return ctx.reply(style.renderError(['Usage: .lcm 4 6']));
    }

    return ctx.reply(style.renderInfo([
      `LCM(${numbers.join(', ')}) = ${numbers.reduce(lcm)}`,
    ]));
  },
};
