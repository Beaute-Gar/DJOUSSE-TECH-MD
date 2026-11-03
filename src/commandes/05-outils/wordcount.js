// @legacy-order {"sourceFile":"05-outils/dev-tools.js","sourceOrder":73,"definitionIndex":11,"entryOrder":143}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['wordcount', 'wc'],
  description: 'Detailed word count',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) return ctx.reply(style.renderError(['Usage: .wc <text>']));

    const words = text.split(/\s+/).filter(Boolean);
    const sentences = text.split(/[.!?]+/).filter(Boolean);
    const vowels = (text.match(/[aeiou]/gi) || []).length;
    const consonants = (text.match(/[bcdfghjklmnpqrstvwxyz]/gi) || []).length;
    const averageWordLength = (text.replace(/\s/g, '').length / words.length).toFixed(1);

    return ctx.reply(style.renderInfo([
      `📊 Text Analysis\n\nCharacters: ${text.length}\nWords: ${words.length}\nSentences: ${sentences.length}\nVowels: ${vowels}\nConsonants: ${consonants}\nAvg word length: ${averageWordLength}`,
    ]));
  },
};
