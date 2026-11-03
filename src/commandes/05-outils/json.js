// @legacy-order {"sourceFile":"05-outils/dev-tools.js","sourceOrder":73,"definitionIndex":0,"entryOrder":132}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['json', 'jsonformat'],
  description: 'Format JSON',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    try {
      const value = JSON.parse(args.join(' '));
      return ctx.reply(style.renderInfo([`\`\`\`\n${JSON.stringify(value, null, 2)}\n\`\`\``]));
    } catch {
      return ctx.reply(style.renderError(['Invalid JSON']));
    }
  },
};
