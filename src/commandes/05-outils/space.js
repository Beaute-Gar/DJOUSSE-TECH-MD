// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":12,"entryOrder":655}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['space', 'spaced'],
  description: 'Add spaces between letters',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .space <text>']));
    }

    return ctx.reply(style.renderInfo([text.split('').join(' ')]));
  },
};
