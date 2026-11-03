// @legacy-order {"sourceFile":"05-outils/misc-extras.js","sourceOrder":144,"definitionIndex":5,"entryOrder":428}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['border', 'box'],
  description: 'Put text in a box',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .border <text>']));
    }

    const lines = text.split('\n');
    const width = Math.max(...lines.map(line => line.length));
    const top = `╔${'═'.repeat(width + 2)}╗`;
    const bottom = `╚${'═'.repeat(width + 2)}╝`;
    const body = lines.map(line => `║ ${line.padEnd(width)} ║`).join('\n');
    return ctx.reply(style.renderInfo([`${top}\n${body}\n${bottom}`]));
  },
};
