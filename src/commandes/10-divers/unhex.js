// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":18,"entryOrder":661}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['unhex', 'fromhex'],
  description: "Convert from hex",
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .unhex <hex>']));
    }
    try {
      return ctx.reply(style.renderInfo([Buffer.from(text, 'hex').toString('utf8')]));
    } catch {
      return ctx.reply(style.renderError(['Invalid hex']));
    }
  },
};
