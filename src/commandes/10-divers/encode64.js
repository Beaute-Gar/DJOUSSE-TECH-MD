// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":13,"entryOrder":656}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['encode64'],
  description: "Encode to base64",
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .encode64 <text>']));
    }
    return ctx.reply(style.renderInfo([Buffer.from(text).toString('base64')]));
  },
};
