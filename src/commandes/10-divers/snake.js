// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":30,"entryOrder":672}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['snake', 'snakecase'],
  description: "Convert to snake_case",
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .snake <text>']));
    }
    return ctx.reply(style.renderInfo([text.toLowerCase().replace(/\s+/g, '_')]));
  },
};
