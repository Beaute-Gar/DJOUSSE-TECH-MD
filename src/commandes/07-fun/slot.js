'use strict';

const style = require('../../config/style');

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎', '7️⃣'];

module.exports = {
  commands: ['slot', 'slots'],
  description: 'Slot machine game',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const spin = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const [first, second, third] = [spin(), spin(), spin()];
    const jackpot = first === second && second === third;
    const partial = first === second || second === third || first === third;
    const result = jackpot
      ? '🎉 JACKPOT! You won!'
      : partial
        ? '😊 Two match! Close one!'
        : '😢 No match. Try again!';

    await ctx.reply(style.renderInfo([
      'Slot Machine',
      '',
      '╔═══════════╗',
      `║ ${first} ║ ${second} ║ ${third} ║`,
      '╚═══════════╝',
      '',
      result,
    ]));
  },
};
