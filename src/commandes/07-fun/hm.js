// @legacy-order {"sourceFile":"07-fun/games.js","sourceOrder":94,"definitionIndex":7,"entryOrder":225}
'use strict';
const style = require('../../config/style');
const games = new Map();
const WORDS = [
  'javascript', 'whatsapp', 'computer', 'elephant', 'chocolate',
  'butterfly', 'rainbow', 'dinosaur', 'umbrella', 'waterfall',
  'mountain', 'telephone', 'adventure', 'beautiful', 'crocodile',
  'pineapple', 'submarine', 'strawberry', 'calculator', 'basketball',
];

function reply(ctx, text, renderer = style.renderInfo) {
  return ctx.reply(renderer(String(text).split('\n')));
}

module.exports = {
  commands: ['hm'],
  description: 'Hangman game',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const key = `${ctx.from}_hangman`;

    if (!args.length || args[0] === 'new') {
      const word = WORDS[Math.floor(Math.random() * WORDS.length)];
      games.set(key, { word, guessed: new Set(), lives: 6 });
      const display = word.split('').map(() => '_').join(' ');
      return reply(ctx, `🎮 *Hangman*\n\n${display}\n\nLives: ❤️❤️❤️❤️❤️❤️\nLetters: ${word.length}\n\nGuess with: .hangman <letter>`);
    }

    const game = games.get(key);
    if (!game) return reply(ctx, 'Start with: .hangman new');

    const letter = args[0].toLowerCase()[0];
    if (game.guessed.has(letter)) return reply(ctx, 'Already guessed!', style.renderError);

    game.guessed.add(letter);
    if (!game.word.includes(letter)) game.lives--;

    const display = game.word.split('').map(char => game.guessed.has(char) ? char : '_').join(' ');
    const hearts = '❤️'.repeat(game.lives) + '🖤'.repeat(6 - game.lives);

    if (game.lives <= 0) {
      games.delete(key);
      return reply(ctx, `💀 *Game Over!*\n\nThe word was: *${game.word}*`, style.renderError);
    }

    if (!display.includes('_')) {
      games.delete(key);
      return reply(ctx, `🎉 *You Won!*\n\n${display}\n\nThe word was: *${game.word}*`, style.renderSuccess);
    }

    return reply(ctx, `🎮 *Hangman*\n\n${display}\n\nLives: ${hearts}\nGuessed: ${[...game.guessed].join(', ')}`);
  },
};
