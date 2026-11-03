// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":4,"entryOrder":393}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['percentage', 'pct'],
  description: "Calculate percentage",
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const [value, total] = args.map(Number);
    if (Number.isNaN(value) || Number.isNaN(total) || total === 0) {
      return ctx.reply(style.renderError(['Usage: .percentage <value> <total>']));
    }
    return ctx.reply(style.renderInfo([
      `📊 ${value} out of ${total} = *${((value / total) * 100).toFixed(2)}%*`,
    ]));
  },
};
