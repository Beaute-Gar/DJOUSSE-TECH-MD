'use strict';
// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":25,"entryOrder":414}

const style = require('../../config/style');

module.exports = {
  commands: ['oct', 'octal'],
  description: 'Convert to/from octal',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const number = Number.parseInt(args[0], 10);
    if (Number.isNaN(number)) {
      return ctx.reply(style.renderError(['Usage: .oct <number>']));
    }

    return ctx.reply(style.renderInfo([
      `${number} = *0o${number.toString(8)}* (octal)`,
    ]));
  },
};
