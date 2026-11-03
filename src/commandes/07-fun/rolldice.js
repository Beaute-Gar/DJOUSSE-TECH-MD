// @legacy-order {"sourceFile":"05-outils/utility-tools.js","sourceOrder":265,"definitionIndex":16,"entryOrder":738}
'use strict';
const style = require('../../config/style');

module.exports = {
  commands: ['rolldice'],
  description: 'Roll dice',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const sides = parseInt(args[0]) || 6;
    const count = Math.min(parseInt(args[1]) || 1, 10);
    const rolls = Array(count)
      .fill(0)
      .map(() => Math.floor(Math.random() * sides) + 1);

    await ctx.reply(style.renderInfo([
      `Dice Roll (${count}x d${sides})`,
      '',
      `Results: ${rolls.join(', ')}`,
      `Total: ${rolls.reduce((sum, roll) => sum + roll, 0)}`,
    ]));
  },
};
