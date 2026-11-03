// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":16,"entryOrder":659}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['unbinary', 'frombin'],
  description: "Convert from binary",
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .unbinary <binary>']));
    }
    try {
      const decoded = text.split(' ')
        .map(binary => String.fromCharCode(Number.parseInt(binary, 2)))
        .join('');
      return ctx.reply(style.renderInfo([decoded]));
    } catch {
      return ctx.reply(style.renderError(['Invalid binary']));
    }
  },
};
