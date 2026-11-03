'use strict';
// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":26,"entryOrder":415}

const style = require('../../config/style');

module.exports = {
  commands: ['log', 'logarithm'],
  description: 'Calculate logarithm',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const number = Number.parseFloat(args[0]);
    const parsedBase = Number.parseFloat(args[1]);
    const base = Number.isNaN(parsedBase) ? Math.E : parsedBase;
    if (!Number.isFinite(number) || number <= 0
        || !Number.isFinite(base) || base <= 0 || base === 1) {
      return ctx.reply(style.renderError(['Usage: .log <number> [base]']));
    }

    const value = Math.log(number) / Math.log(base);
    return ctx.reply(style.renderInfo([
      `📊 log${base === Math.E ? 'e' : base}(${number}) = *${value.toFixed(6)}*`,
    ]));
  },
};
