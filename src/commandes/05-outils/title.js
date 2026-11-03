// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":29,"entryOrder":671}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['title', 'titlecase'],
  description: 'Title case text',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .title <text>']));
    }

    return ctx.reply(style.renderInfo([
      text.replace(/\b\w/g, character => character.toUpperCase()),
    ]));
  },
};
