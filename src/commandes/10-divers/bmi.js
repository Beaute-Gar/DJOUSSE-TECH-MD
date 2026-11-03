// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":17,"entryOrder":406}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['bmi', 'bodymass'],
  description: "Calculate BMI",
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const [weight, height] = args.map(Number);
    if (Number.isNaN(weight) || Number.isNaN(height) || height === 0) {
      return ctx.reply(style.renderError(['Usage: .bmi <weight_kg> <height_cm>']));
    }

    const bmi = weight / ((height / 100) ** 2);
    const category = bmi < 18.5 ? 'Underweight'
      : bmi < 25 ? 'Normal'
        : bmi < 30 ? 'Overweight'
          : 'Obese';
    return ctx.reply(style.renderInfo([
      '📊 *BMI Calculator*',
      '',
      `Weight: ${weight}kg`,
      `Height: ${height}cm`,
      `BMI: *${bmi.toFixed(1)}*`,
      `Category: ${category}`,
    ]));
  },
};
