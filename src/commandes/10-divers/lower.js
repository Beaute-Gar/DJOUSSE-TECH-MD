// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":2,"entryOrder":645}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['lower', 'lowercase'],
  description: "Convert to lowercase",
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .lower <text>']));
    }
    return ctx.reply(style.renderInfo([text.toLowerCase()]));
  },
};
