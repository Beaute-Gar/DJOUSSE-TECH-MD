// @legacy-order {"sourceFile":"05-outils/dev-tools.js","sourceOrder":73,"definitionIndex":1,"entryOrder":133}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['urlencode', 'encodeurl'],
  description: "URL encode",
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .urlencode <text>']));
    }
    return ctx.reply(style.renderInfo([encodeURIComponent(text)]));
  },
};
