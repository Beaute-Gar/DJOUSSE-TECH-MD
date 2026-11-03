'use strict';
// @legacy-order {"sourceFile":"05-outils/math-tools.js","sourceOrder":138,"definitionIndex":22,"entryOrder":411}
const style = require('../../config/style');

module.exports = {
  commands: ['unitconvert'],
  description: 'Unit converter',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const value = Number.parseFloat(args[0]);
    const from = (args[1] || '').toLowerCase();
    const to = (args[2] || '').toLowerCase();
    const conversions = {
      km: { mi: 0.621371, m: 1000 },
      mi: { km: 1.60934 },
      kg: { lb: 2.20462, g: 1000 },
      lb: { kg: 0.453592 },
      cm: { in: 0.393701, mm: 10 },
      in: { cm: 2.54 },
      l: { gal: 0.264172, ml: 1000 },
      gal: { l: 3.78541 },
      m: { ft: 3.28084, cm: 100 },
      ft: { m: 0.3048 },
    };

    if (!Number.isFinite(value) || !from) {
      return ctx.reply(style.renderError([
        'Usage: .unitconvert <value> <from> <to>',
        '',
        'Supported: km/mi, kg/lb, cm/in, l/gal, m/ft',
      ]));
    }

    if (!Object.hasOwn(conversions[from] || {}, to)) {
      return ctx.reply(style.renderError([
        'Unknown conversion. Supported: km/mi, kg/lb, cm/in, l/gal, m/ft',
      ]));
    }

    return ctx.reply(style.renderInfo([
      `📐 ${value} ${from} = *${(value * conversions[from][to]).toFixed(4)} ${to}*`,
    ]));
  },
};
