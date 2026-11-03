'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['rateme'],
  description: 'Rate something',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const subject = args.join(' ');
    if (!subject) {
      return ctx.reply(style.renderError(['Usage', '', '.rate <anything>']));
    }

    const score = Math.floor(Math.random() * 11);
    const stars = '⭐'.repeat(score) + '☆'.repeat(10 - score);
    const verdict = score >= 8
      ? 'Amazing! 🔥'
      : score >= 5
        ? 'Not bad! 👍'
        : 'Needs improvement 😅';
    await ctx.reply(style.renderInfo([
      'Rating',
      '',
      `Subject: ${subject}`,
      `Score: ${score}/10`,
      stars,
      '',
      verdict,
    ]));
  },
};
