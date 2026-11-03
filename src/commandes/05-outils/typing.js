// @legacy-order {"sourceFile":"05-outils/education.js","sourceOrder":81,"definitionIndex":8,"entryOrder":158}
'use strict';

const style = require('../../config/style');

const SENTENCES = Object.freeze([
  'The quick brown fox jumps over the lazy dog',
  'A journey of a thousand miles begins with a single step',
  'To be or not to be that is the question',
  'All that glitters is not gold',
  'Knowledge is power and power is responsibility',
]);

module.exports = {
  commands: ['typing', 'wpm'],
  description: 'Typing speed test',
  permission: 'public',
  run: async (_sock, _message, _args, ctx) => {
    const sentence = SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
    return ctx.reply(style.renderInfo([
      'Typing Test',
      '',
      'Type this as fast as you can:',
      '',
      sentence,
      '',
      'Time starts now! Reply with the exact text.',
    ]));
  },
};
