// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":21,"entryOrder":663}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['caesar'],
  description: 'ROT13 cipher',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .rot13 <text>']));
    }

    const result = text.replace(/[a-zA-Z]/g, character =>
      String.fromCharCode(character.charCodeAt(0)
        + (character.toLowerCase() < 'n' ? 13 : -13)));
    return ctx.reply(style.renderInfo([result]));
  },
};
