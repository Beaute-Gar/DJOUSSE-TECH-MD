// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":0,"entryOrder":643}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['rev'],
  description: 'Reverse text',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .reverse <text>']));
    }

    return ctx.reply(style.renderInfo([text.split('').reverse().join('')]));
  },
};
