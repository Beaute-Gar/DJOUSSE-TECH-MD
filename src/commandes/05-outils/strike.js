// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":10,"entryOrder":653}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['strike', 'strikethrough'],
  description: 'Strike through text',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .strike <text>']));
    }

    return ctx.reply(style.renderInfo([`${text.split('').join('\u0336')}\u0336`]));
  },
};
