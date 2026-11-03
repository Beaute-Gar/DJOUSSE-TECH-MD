// @legacy-order {"sourceFile":"07-fun/games.js","sourceOrder":94,"definitionIndex":9,"entryOrder":227}
'use strict';
const style = require('../../config/style');
const games = new Map();
const WORDS = [
  'programming', 'technology', 'computer', 'internet', 'algorithm',
  'database', 'software', 'keyboard', 'wireless', 'bluetooth',
  'satellite', 'astronomy', 'chemistry', 'geography', 'democracy',
  'education', 'economics', 'literature', 'philosophy', 'psychology',
  'revolution', 'newspaper', 'adventure', 'chocolate', 'basketball',
  'volleyball', 'sunflower', 'butterfly', 'crocodile', 'pineapple',
];

function reply(ctx, text, renderer = style.renderInfo) {
  return ctx.reply(renderer(String(text).split('\n')));
}

module.exports = {
  commands: ['wordscramble', 'unscramble'],
  description: 'Word scramble game',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const key = `${ctx.from}_scramble`;

    if (args[0] === 'solve' && games.has(key)) {
      const answer = games.get(key);
      games.delete(key);
      return reply(ctx, `💡 Answer: *${answer}*`, style.renderSuccess);
    }

    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    const scrambled = word.split('').sort(() => Math.random() - 0.5).join('');
    games.set(key, word);
    return reply(ctx, `🔤 *Word Scramble*\n\nUnscramble: *${scrambled}*\n\nHint: ${word.length} letters, starts with "${word[0]}"\n\nType your answer or .wordscramble solve`);
  },
};
