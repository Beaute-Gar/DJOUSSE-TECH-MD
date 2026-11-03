// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":6,"entryOrder":395}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['power', 'pow'],
  description: 'Power/exponent',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const [base, exponent] = args.map(Number);
    if (Number.isNaN(base) || Number.isNaN(exponent)) {
      return ctx.reply(style.renderError(['Usage: .power <base> <exponent>']));
    }

    return ctx.reply(style.renderInfo([
      `${base}^${exponent} = ${Math.pow(base, exponent)}`,
    ]));
  },
};
