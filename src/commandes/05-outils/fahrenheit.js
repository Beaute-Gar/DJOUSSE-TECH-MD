// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":16,"entryOrder":405}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['fahrenheit', 'ctof'],
  description: 'Celsius to Fahrenheit',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const celsius = Number.parseFloat(args[0]);
    if (Number.isNaN(celsius)) {
      return ctx.reply(style.renderError(['Usage: .fahrenheit <celsius>']));
    }

    return ctx.reply(style.renderInfo([
      `🌡️ ${celsius}°C = ${(celsius * 9 / 5 + 32).toFixed(2)}°F`,
    ]));
  },
};
