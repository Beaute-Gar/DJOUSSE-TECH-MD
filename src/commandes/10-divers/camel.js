// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":31,"entryOrder":673}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['camel', 'camelcase'],
  description: "Convert to camelCase",
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .camel <text>']));
    }
    const words = text.split(/\s+/);
    const camelCase = words[0].toLowerCase()
      + words.slice(1).map(word => word[0].toUpperCase() + word.slice(1).toLowerCase()).join('');
    return ctx.reply(style.renderInfo([camelCase]));
  },
};
