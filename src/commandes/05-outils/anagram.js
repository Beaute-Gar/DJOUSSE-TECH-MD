// @legacy-order {"sourceFile":"05-outils/language-tools.js","sourceOrder":127,"definitionIndex":11,"entryOrder":353}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['anagram', 'isanagram'],
  description: 'Check if anagram',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const parts = args.join(' ').split(/[,|\/]/);
    if (parts.length < 2) {
      return ctx.reply(style.renderError(['Usage: .anagram word1, word2']));
    }

    const [first, second] = parts.map(value =>
      value.trim().toLowerCase().replace(/\s/g, '').split('').sort().join(''),
    );
    const text = `"${parts[0].trim()}" and "${parts[1].trim()}" ${
      first === second ? 'ARE ✅' : 'are NOT ❌'
    } anagrams`;

    return ctx.reply(style.renderInfo([text]));
  },
};
