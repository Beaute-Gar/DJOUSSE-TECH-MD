// @legacy-order {"sourceFile":"05-outils/language-tools.js","sourceOrder":127,"definitionIndex":10,"entryOrder":352}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['palindrome', 'ispalindrome'],
  description: 'Check if palindrome',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .palindrome <word or phrase>']));
    }

    const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isPalindrome = normalized === normalized.split('').reverse().join('');
    return ctx.reply(style.renderInfo([
      `🔤 "${text}" ${isPalindrome ? 'IS ✅' : 'is NOT ❌'} a palindrome`,
    ]));
  },
};
