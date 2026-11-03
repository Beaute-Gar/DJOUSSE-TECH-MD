// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":10,"entryOrder":399}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['random', 'rng'],
  description: 'Random number',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const minimum = Number.parseInt(args[0], 10) || 1;
    const maximum = Number.parseInt(args[1], 10) || 100;
    const result = Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;

    return ctx.reply(style.renderInfo([
      `🎲 Random (${minimum}-${maximum}): ${result}`,
    ]));
  },
};
