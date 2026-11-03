// @legacy-order {"sourceFile":"05-outils/dev-tools.js","sourceOrder":73,"definitionIndex":5,"entryOrder":137}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['regex', 'testregex'],
  description: 'Test regex pattern',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const pattern = args[0];
    const text = args.slice(1).join(' ');
    if (!pattern || !text) {
      return ctx.reply(style.renderError(['Usage: .regex <pattern> <text>']));
    }

    try {
      const regex = new RegExp(pattern, 'g');
      const matches = text.match(regex);
      return ctx.reply(style.renderInfo([
        `🔍 *Regex Test*\n\nPattern: /${pattern}/g\nText: ${text}\nMatches: ${matches ? matches.join(', ') : 'None'}\nCount: ${matches ? matches.length : 0}`,
      ]));
    } catch (error) {
      return ctx.reply(style.renderError([`Invalid regex: ${error.message}`]));
    }
  },
};
