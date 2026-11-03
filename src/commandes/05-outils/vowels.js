// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":22,"entryOrder":664}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['vowels', 'novowels'],
  description: 'Remove vowels',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .vowels <text>']));
    }

    return ctx.reply(style.renderInfo([text.replace(/[aeiouAEIOU]/g, '')]));
  },
};
