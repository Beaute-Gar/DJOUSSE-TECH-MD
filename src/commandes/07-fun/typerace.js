// @legacy-order {"sourceFile":"07-fun/emoji-games.js","sourceOrder":82,"definitionIndex":10,"entryOrder":174}
'use strict';
const style = require('../../config/style');
const state = require('./_quiz-state');
const PHRASES = [
  'The quick brown fox jumps over the lazy dog',
  'Practice makes perfect and nobody is perfect',
  'Life is like a box of chocolates you never know what you get',
  'Actions speak louder than words so show dont tell',
  'Every cloud has a silver lining keep looking up',
];

module.exports = {
  commands: ['typerace', 'typing2'],
  description: 'Typing race challenge',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    state[`${ctx.from}_tr`] = { phrase, time: Date.now() };
    await ctx.reply(style.renderOutgoingText(
      `⌨️ *Typing Race!*\n\nType this exactly:\n\n*${phrase}*\n\nReply with .typecheck <your text>`
    ));
  },
};
