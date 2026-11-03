// @legacy-order {"sourceFile":"07-fun/games.js","sourceOrder":94,"definitionIndex":1,"entryOrder":221}
'use strict';
const style = require('../../config/style');
const games = new Map();

function reply(ctx, text, renderer = style.renderInfo) {
  return ctx.reply(renderer(String(text).split('\n')));
}

module.exports = {
  commands: ['guess', 'guessnum'],
  description: 'Number guessing game',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const key = ctx.from;

    if (!args.length) {
      games.set(key, Math.floor(Math.random() * 100) + 1);
      return reply(ctx, '🎯 *Number Guessing Game*\n\nI picked a number between 1-100.\nGuess it with: .guess <number>');
    }

    const guess = parseInt(args[0]);
    if (!games.has(key)) return reply(ctx, 'Start a new game with: .guess');
    if (Number.isNaN(guess)) return reply(ctx, 'Enter a number!', style.renderError);

    const number = games.get(key);
    if (guess === number) {
      games.delete(key);
      return reply(ctx, '🎉 *Correct!* You got it!', style.renderSuccess);
    }

    return reply(ctx, guess < number ? '⬆️ Too low! Try higher.' : '⬇️ Too high! Try lower.');
  },
};
