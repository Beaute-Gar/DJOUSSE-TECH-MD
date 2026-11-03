// @legacy-order {"sourceFile":"05-outils/misc-extras.js","sourceOrder":144,"definitionIndex":3,"entryOrder":426}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['uwu', 'uwuify'],
  description: 'UwUify text',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .uwu <text>']));
    }

    const result = text
      .replace(/[lr]/g, 'w')
      .replace(/[LR]/g, 'W')
      .replace(/n([aeiou])/g, 'ny$1')
      .replace(/N([AEIOU])/g, 'NY$1')
      .replace(/ove/g, 'uv');
    return ctx.reply(style.renderInfo([`${result} UwU`]));
  },
};
