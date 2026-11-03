// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":9,"entryOrder":398}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['fibonacci', 'fib'],
  description: 'Fibonacci sequence',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const count = Math.min(Number.parseInt(args[0], 10) || 10, 50);
    const sequence = [0, 1];
    for (let index = 2; index < count; index += 1) {
      sequence.push(sequence[index - 1] + sequence[index - 2]);
    }

    return ctx.reply(style.renderInfo([
      `🔢 Fibonacci (${count})`,
      sequence.join(', '),
    ]));
  },
};
