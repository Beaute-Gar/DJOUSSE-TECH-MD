// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":23,"entryOrder":665}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['shuffle', 'scramble'],
  description: 'Shuffle text',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .shuffle <text>']));
    }

    const characters = text.split('');
    for (let index = characters.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [characters[index], characters[other]] = [characters[other], characters[index]];
    }
    return ctx.reply(style.renderInfo([characters.join('')]));
  },
};
