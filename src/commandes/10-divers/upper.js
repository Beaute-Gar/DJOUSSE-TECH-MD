// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":1,"entryOrder":644}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['upper', 'caps'],
  description: "Convert to uppercase",
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .upper <text>']));
    }
    return ctx.reply(style.renderInfo([text.toUpperCase()]));
  },
};
