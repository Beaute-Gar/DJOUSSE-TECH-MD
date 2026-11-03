// @legacy-order {"sourceFile":"05-outils/dev-tools.js","sourceOrder":73,"definitionIndex":2,"entryOrder":134}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['urldecode', 'decodeurl'],
  description: "URL decode",
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .urldecode <encoded>']));
    }
    try {
      return ctx.reply(style.renderInfo([decodeURIComponent(text)]));
    } catch {
      return ctx.reply(style.renderError(['Invalid encoded string']));
    }
  },
};
