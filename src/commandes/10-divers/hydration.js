// @legacy-order {"sourceFile":"05-outils/health-fitness.js","sourceOrder":111,"definitionIndex":3,"entryOrder":317}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['hydration', 'waterintake'],
  description: "Water intake calculator",
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const weight = Number.parseFloat(args[0]);
    if (!weight) {
      return ctx.reply(style.renderError(['Usage: .water <weight_kg>']));
    }
    const liters = (weight * 0.033).toFixed(1);
    const glasses = Math.ceil(liters * 4.23);
    return ctx.reply(style.renderInfo([
      '💧 *Daily Water Intake*',
      '',
      `Weight: ${weight}kg`,
      `Recommended: ${liters} liters`,
      `Glasses (240ml): ~${glasses} glasses`,
      '',
      '_Stay hydrated! 💦_',
    ]));
  },
};
