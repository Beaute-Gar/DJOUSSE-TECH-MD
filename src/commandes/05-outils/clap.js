// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":25,"entryOrder":667}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['clap', 'clapback'],
  description: 'Add clap emoji between words',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .clap <text>']));
    }

    return ctx.reply(style.renderInfo([text.split(/\s+/).join(' 👏 ')]));
  },
};
