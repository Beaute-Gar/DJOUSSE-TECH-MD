// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":28,"entryOrder":417}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['abs', 'absolute'],
  description: 'Absolute value',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const number = Number.parseFloat(args[0]);
    if (Number.isNaN(number)) {
      return ctx.reply(style.renderError(['Usage: .abs <number>']));
    }

    return ctx.reply(style.renderInfo([`|${number}| = ${Math.abs(number)}`]));
  },
};
