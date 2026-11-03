// @legacy-order {"sourceFile":"05-outils/misc-extras.js","sourceOrder":144,"definitionIndex":14,"entryOrder":437}
'use strict';
const style = require('../../config/style');

module.exports = {
  commands: ['fortune2', 'luckynumber'],
  description: 'Lucky numbers',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const numbers = Array(6)
      .fill(0)
      .map(() => Math.floor(Math.random() * 49) + 1)
      .sort((a, b) => a - b);
    await ctx.reply(style.renderInfo([
      'Lucky Numbers',
      '',
      `🍀 ${numbers.join(' - ')}`,
      '',
      '_May fortune smile upon you! 🌟_',
    ]));
  },
};
