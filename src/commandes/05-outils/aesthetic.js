// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":26,"entryOrder":668}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['aesthetic', 'vaporwave'],
  description: 'Aesthetic/vaporwave text',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .aesthetic <text>']));
    }

    const result = text.split('').map(character => {
      if (character === ' ') return '  ';
      return String.fromCharCode(character.charCodeAt(0)
        + (/[a-zA-Z0-9]/.test(character) ? 0xFF00 - 0x20 : 0));
    }).join('');
    return ctx.reply(style.renderInfo([result]));
  },
};
