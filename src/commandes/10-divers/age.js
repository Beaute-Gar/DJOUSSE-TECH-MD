// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":20,"entryOrder":409}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['age', 'agecalc'],
  description: "Calculate age",
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const date = new Date(args.join(' '));
    if (Number.isNaN(date.getTime())) {
      return ctx.reply(style.renderError(['Usage: .age 1990-01-15']));
    }

    const now = new Date();
    let years = now.getFullYear() - date.getFullYear();
    const monthDifference = now.getMonth() - date.getMonth();
    if (monthDifference < 0
        || (monthDifference === 0 && now.getDate() < date.getDate())) {
      years--;
    }
    const days = Math.floor((now - date) / 86400000);
    return ctx.reply(style.renderInfo([
      '🎂 *Age Calculator*',
      '',
      `Born: ${date.toDateString()}`,
      `Age: *${years} years*`,
      `Days lived: ${days.toLocaleString()}`,
    ]));
  },
};
