// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":3,"entryOrder":646}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['count', 'charcount'],
  description: 'Count characters/words',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .count <text>']));
    }

    return ctx.reply(style.renderInfo([
      `Characters: ${text.length}`,
      `Words: ${text.split(/\s+/).filter(Boolean).length}`,
      `Lines: ${text.split('\n').length}`,
      `Spaces: ${(text.match(/ /g) || []).length}`,
    ]));
  },
};
