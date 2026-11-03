// @legacy-order {"sourceFile":"05-outils/misc-extras.js","sourceOrder":144,"definitionIndex":8,"entryOrder":431}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['backwards', 'reversewords'],
  description: 'Reverse word order',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .backwards <sentence>']));
    }

    return ctx.reply(style.renderInfo([text.split(' ').reverse().join(' ')]));
  },
};
