// @legacy-order {"sourceFile":"07-fun/emoji-games.js","sourceOrder":82,"definitionIndex":8,"entryOrder":172}
'use strict';
const style = require('../../config/style');
const state = require('./_quiz-state');
const WORDS = [
  'elephant', 'chocolate', 'sunshine', 'computer', 'beautiful',
  'adventure', 'knowledge', 'mountain', 'dinosaur', 'universe',
  'butterfly', 'waterfall', 'pineapple', 'telephone', 'chemistry',
  'geography', 'astronomy', 'education', 'democracy', 'evolution',
];

module.exports = {
  commands: ['unscramble2', 'wordchallenge'],
  description: 'Unscramble challenge',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    const scrambled = word.split('').sort(() => Math.random() - 0.5).join('');
    state[`${ctx.from}_us`] = word;
    await ctx.reply(style.renderOutgoingText(
      `🔤 *Unscramble!*\n\n*${scrambled.toUpperCase()}*\n\nHint: ${word.length} letters\nCategory: General Knowledge\n\nReply with .unscrambleanswer <word>`
    ));
  },
};
