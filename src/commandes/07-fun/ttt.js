// @legacy-order {"sourceFile":"07-fun/games.js","sourceOrder":94,"definitionIndex":8,"entryOrder":226}
'use strict';
const style = require('../../config/style');
const games = new Map();
const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];
const POSITION_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

function reply(ctx, text, renderer = style.renderInfo) {
  return ctx.reply(renderer(String(text).split('\n')));
}

function hasWon(board, player) {
  return WINNING_LINES.some(([a, b, c]) => board[a] === player && board[b] === player && board[c] === player);
}

function renderBoard(board) {
  return [0, 1, 2]
    .map(row => [0, 1, 2]
      .map(column => {
        const index = row * 3 + column;
        return board[index] === 'X' ? '❌' : board[index] === 'O' ? '⭕' : POSITION_EMOJIS[index];
      })
      .join(''))
    .join('\n');
}

module.exports = {
  commands: ['ttt'],
  description: 'Tic Tac Toe',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const key = `${ctx.from}_ttt`;

    if (!args.length || args[0] === 'new') {
      games.set(key, { board: Array(9).fill(null), turn: 'X' });
      return reply(ctx, '❌⭕ *Tic Tac Toe*\n\n1️⃣2️⃣3️⃣\n4️⃣5️⃣6️⃣\n7️⃣8️⃣9️⃣\n\nYou are X. Pick a position (1-9):\n.ttt <number>');
    }

    const game = games.get(key);
    if (!game) return reply(ctx, 'Start with: .ttt new');

    const position = parseInt(args[0]) - 1;
    if (Number.isNaN(position) || position < 0 || position > 8 || game.board[position]) {
      return reply(ctx, 'Invalid move!', style.renderError);
    }

    game.board[position] = 'X';
    if (hasWon(game.board, 'X')) {
      games.delete(key);
      return reply(ctx, '🎉 *You Win!*', style.renderSuccess);
    }

    const empty = game.board.map((value, index) => value === null ? index : null).filter(value => value !== null);
    if (!empty.length) {
      games.delete(key);
      return reply(ctx, "🤝 *It's a tie!*", style.renderSuccess);
    }

    const botMove = empty[Math.floor(Math.random() * empty.length)];
    game.board[botMove] = 'O';
    if (hasWon(game.board, 'O')) {
      games.delete(key);
      return reply(ctx, '😎 *I Win!*');
    }

    return reply(ctx, `❌⭕ *Tic Tac Toe*\n\n${renderBoard(game.board)}\n\nYour turn! .ttt <number>`);
  },
};
