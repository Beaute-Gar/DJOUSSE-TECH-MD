// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":23,"entryOrder":412}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['hex2dec', 'hextodec'],
  description: 'Hex to decimal',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const hexadecimal = args[0];
    if (!hexadecimal) {
      return ctx.reply(style.renderError(['Usage: .hex2dec <hex>']));
    }

    return ctx.reply(style.renderInfo([
      `0x${hexadecimal} = ${Number.parseInt(hexadecimal, 16)}`,
    ]));
  },
};
