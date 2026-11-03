// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":5,"entryOrder":648}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['mock', 'spongebob'],
  description: 'sPoNgEbOb MoCk text',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .mock <text>']));
    }

    const result = text.split('').map((character, index) =>
      index % 2 ? character.toUpperCase() : character.toLowerCase()).join('');
    return ctx.reply(style.renderInfo([result]));
  },
};
