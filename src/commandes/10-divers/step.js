// @legacy-order {"sourceFile":"05-outils/health-fitness.js","sourceOrder":111,"definitionIndex":6,"entryOrder":320}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['step', 'steps'],
  description: "Steps to distance calculator",
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const steps = Number.parseInt(args[0]);
    if (!steps) {
      return ctx.reply(style.renderError(['Usage: .steps <number>']));
    }
    const kilometers = (steps * 0.000762).toFixed(2);
    const miles = (kilometers * 0.621371).toFixed(2);
    const calories = Math.floor(steps * 0.04);
    const goal = steps >= 10000
      ? '✅ Reached!'
      : `${((steps / 10000) * 100).toFixed(1)}%`;
    return ctx.reply(style.renderInfo([
      '👣 *Steps Calculator*',
      '',
      `Steps: ${steps.toLocaleString()}`,
      `Distance: ${kilometers} km (${miles} mi)`,
      `Calories: ~${calories} kcal`,
      `Goal (10k): ${goal}`,
    ]));
  },
};
