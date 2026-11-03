// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":29,"entryOrder":418}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['round'],
  description: 'Round number',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const number = Number.parseFloat(args[0]);
    if (Number.isNaN(number)) {
      return ctx.reply(style.renderError([
        'Usage: .round <number> [decimal_places]',
      ]));
    }

    const requestedPlaces = Number.parseInt(args[1], 10) || 0;
    const places = Math.max(0, Math.min(requestedPlaces, 100));
    return ctx.reply(style.renderInfo([
      `${number} ≈ ${number.toFixed(places)}`,
    ]));
  },
};
