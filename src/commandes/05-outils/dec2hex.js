// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":24,"entryOrder":413}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['dec2hex', 'dectohex'],
  description: 'Decimal to hex',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const number = Number.parseInt(args[0], 10);
    if (Number.isNaN(number)) {
      return ctx.reply(style.renderError(['Usage: .dec2hex <number>']));
    }

    return ctx.reply(style.renderInfo([
      `${number} = 0x${number.toString(16).toUpperCase()}`,
    ]));
  },
};
