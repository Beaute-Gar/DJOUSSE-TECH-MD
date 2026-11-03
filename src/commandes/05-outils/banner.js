// @legacy-order {"sourceFile":"05-outils/misc-extras.js","sourceOrder":144,"definitionIndex":6,"entryOrder":429}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['banner', 'textbanner'],
  description: 'Create text banner',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ').toUpperCase();
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .banner <text>']));
    }

    const border = '═'.repeat(text.length + 4);
    return ctx.reply(style.renderInfo([`\n${border}\n║ ${text} ║\n${border}`]));
  },
};
