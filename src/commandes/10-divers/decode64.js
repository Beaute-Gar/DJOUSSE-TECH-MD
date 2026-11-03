// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":14,"entryOrder":657}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['decode64', 'unbase64'],
  description: "Decode from base64",
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .decode64 <base64>']));
    }
    try {
      return ctx.reply(style.renderInfo([Buffer.from(text, 'base64').toString('utf8')]));
    } catch {
      return ctx.reply(style.renderError(['Invalid base64']));
    }
  },
};
