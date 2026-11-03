// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":15,"entryOrder":658}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['bin'],
  description: "Convert to binary",
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .binary <text>']));
    }
    const binary = text.split('')
      .map(character => character.charCodeAt(0).toString(2).padStart(8, '0'))
      .join(' ');
    return ctx.reply(style.renderInfo([binary]));
  },
};
