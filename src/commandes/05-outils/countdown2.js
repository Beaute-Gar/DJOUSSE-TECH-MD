// @legacy-order {"sourceFile":"05-outils/utility-tools.js","sourceOrder":265,"definitionIndex":17,"entryOrder":739}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['countdown2', 'daysto'],
  description: 'Days until date',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const date = new Date(args.join(' '));
    if (Number.isNaN(date.getTime())) {
      return ctx.reply(style.renderError(['Usage: .daysto 2025-12-25']));
    }

    const days = Math.ceil((date - new Date()) / 86400000);
    const message = days > 0
      ? `${days} days remaining`
      : days === 0
        ? "That's today!"
        : `${Math.abs(days)} days ago`;

    return ctx.reply(style.renderInfo([`📅 Countdown\n\nDate: ${date.toDateString()}\n${message}`]));
  },
};
