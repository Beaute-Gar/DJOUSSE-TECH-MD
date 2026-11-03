'use strict';
// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":28,"entryOrder":670}

const style = require('../../config/style');

module.exports = {
  commands: ['leetspeak', '1337'],
  description: 'Convert to leet speak',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .leet <text>']));
    }

    const map = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7', l: '1', g: '9' };
    const converted = text.toLowerCase().split('').map((character) =>
      map[character] || character
    ).join('');
    return ctx.reply(style.renderInfo([converted]));
  },
};
