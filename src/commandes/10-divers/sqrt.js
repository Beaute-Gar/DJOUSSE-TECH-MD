// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":5,"entryOrder":394}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['sqrt', 'squareroot'],
  description: "Square root",
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const number = Number.parseFloat(args[0]);
    if (Number.isNaN(number)) {
      return ctx.reply(style.renderError(['Usage: .sqrt <number>']));
    }
    return ctx.reply(style.renderInfo([
      `√${number} = *${Math.sqrt(number).toFixed(6)}*`,
    ]));
  },
};
