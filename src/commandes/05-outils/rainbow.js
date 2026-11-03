// @legacy-order {"sourceFile":"05-outils/misc-extras.js","sourceOrder":144,"definitionIndex":9,"entryOrder":432}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['rainbow', 'colortext'],
  description: 'Rainbow text',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .rainbow <text>']));
    }

    const colors = ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣'];
    const result = text.split('').map((character, index) => (
      character === ' ' ? '  ' : `${colors[index % colors.length]}${character}`
    )).join('');
    return ctx.reply(style.renderInfo([result]));
  },
};
