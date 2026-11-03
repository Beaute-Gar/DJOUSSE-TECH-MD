// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":27,"entryOrder":416}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['pi'],
  description: 'Show Pi digits',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const requestedDigits = Number.parseInt(args[0], 10) || 50;
    const digits = Math.max(0, Math.min(requestedDigits, 100));
    return ctx.reply(style.renderInfo([
      `🥧 Pi (${digits} digits)`,
      Math.PI.toFixed(digits),
    ]));
  },
};
