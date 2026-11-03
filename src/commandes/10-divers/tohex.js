// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":17,"entryOrder":660}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['tohex'],
  description: "Convert to hex",
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .hex <text>']));
    }
    return ctx.reply(style.renderInfo([Buffer.from(text).toString('hex')]));
  },
};
