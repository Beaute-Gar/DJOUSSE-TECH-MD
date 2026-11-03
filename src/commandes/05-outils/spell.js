// @legacy-order {"sourceFile":"05-outils/education.js","sourceOrder":81,"definitionIndex":5,"entryOrder":155}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['spell', 'spellcheck'],
  description: 'Spell a word',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const word = args.join(' ');
    if (!word) {
      return ctx.reply(style.renderError(['Usage: .spell <word>']));
    }

    return ctx.reply(style.renderInfo([
      '📝 Spelling',
      word.split('').map(character => character.toUpperCase()).join(' - '),
    ]));
  },
};
