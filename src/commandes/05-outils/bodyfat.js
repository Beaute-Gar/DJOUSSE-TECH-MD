// @legacy-order {"sourceFile":"05-outils/health-fitness.js","sourceOrder":111,"definitionIndex":10,"entryOrder":324}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['bodyfat', 'bfp'],
  description: 'Body fat percentage estimate',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const [waist, neck, height] = args.map(Number);
    if ([waist, neck, height].some(value => Number.isNaN(Number(value)))) {
      return ctx.reply(style.renderError([
        'Usage: .bodyfat <waist_cm> <neck_cm> <height_cm>',
      ]));
    }

    const bodyFat = 495 / (
      1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)
    ) - 450;
    const category = bodyFat < 15
      ? 'Athletic 💪'
      : bodyFat < 20
        ? 'Fit 🏃'
        : bodyFat < 25
          ? 'Average 🙂'
          : bodyFat < 30
            ? 'Above average ⚠️'
            : 'Consider exercise 🏋️';

    return ctx.reply(style.renderInfo([
      'Body Fat Estimate',
      '',
      `Waist: ${waist}cm`,
      `Neck: ${neck}cm`,
      `Height: ${height}cm`,
      '',
      `Body Fat: ~${bodyFat.toFixed(1)}%`,
      '',
      category,
      '',
      'This is an estimate using the US Navy method.',
    ]));
  },
};
