// @legacy-order {"sourceFile":"07-fun/entertainment.js","sourceOrder":85,"definitionIndex":8,"entryOrder":189}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['shipping', 'lovematch'],
  description: 'Check the playful compatibility of two names',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ').trim();
    const parts = text.split(/\s+and\s+|\s*[x&]\s*/i).map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) {
      return ctx.reply(style.renderError(['Usage', '', '.shipping Name1 and Name2']));
    }

    const [first, second] = parts;
    const score = (first.length * second.length * 7 + first.charCodeAt(0) + second.charCodeAt(0)) % 101;
    const filled = Math.floor(score / 10);
    const bar = `${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`;
    const verdict = score > 90
      ? '💕 Perfect match!'
      : score > 70
        ? '💛 Great compatibility!'
        : score > 50
          ? '💙 Worth a shot!'
          : score > 30
            ? '🤔 Hmm, maybe...'
            : '💔 Not ideal...';

    await ctx.reply(style.renderInfo([
      'Love Match',
      '',
      `${first} ❤️ ${second}`,
      `[${bar}] ${score}%`,
      '',
      verdict,
    ]));
  },
};
