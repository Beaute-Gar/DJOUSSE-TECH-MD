// @legacy-order {"sourceFile":"05-outils/dev-tools.js","sourceOrder":73,"definitionIndex":8,"entryOrder":140}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['ascii2', 'charcode'],
  description: 'ASCII character codes',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .ascii2 <text>']));
    }

    return ctx.reply(style.renderInfo([
      `📊 *ASCII Codes*\n\n${text.split('').map(character => `'${character}' = ${character.charCodeAt(0)}`).join('\n')}`,
    ]));
  },
};
