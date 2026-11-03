// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":4,"entryOrder":647}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['repeat', 'rep'],
  description: 'Repeat text',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const requestedCount = Number.parseInt(args[0], 10) || 3;
    const count = Math.max(1, Math.min(requestedCount, 20));
    const text = args.slice(1).join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .repeat 5 hello']));
    }

    return ctx.reply(style.renderInfo([Array(count).fill(text).join('\n')]));
  },
};
