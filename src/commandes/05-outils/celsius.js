// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":15,"entryOrder":404}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['celsius', 'ftoc'],
  description: 'Fahrenheit to Celsius',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const fahrenheit = Number.parseFloat(args[0]);
    if (Number.isNaN(fahrenheit)) {
      return ctx.reply(style.renderError(['Usage: .celsius <fahrenheit>']));
    }

    return ctx.reply(style.renderInfo([
      `🌡️ ${fahrenheit}°F = ${((fahrenheit - 32) * 5 / 9).toFixed(2)}°C`,
    ]));
  },
};
