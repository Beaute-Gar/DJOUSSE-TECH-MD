// @legacy-order {"sourceFile":"07-fun/games3.js","sourceOrder":95,"definitionIndex":0,"entryOrder":241}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['tttai'],
  description: 'Play a quick Tic-Tac-Toe move against the AI',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    const board = Array(9).fill('·');
    const moves = [4, 0, 2, 6, 8, 1, 3, 5, 7];
    const aiMove = moves[Math.floor(Math.random() * 4)];
    board[aiMove] = '🔵';
    const rows = [0, 3, 6].map((start) => board.slice(start, start + 3).join(' '));

    await ctx.reply(style.renderInfo([
      'Tic-Tac-Toe vs AI',
      '',
      ...rows,
      '',
      'Use .ttt to start a full game.',
    ]));
  },
};
