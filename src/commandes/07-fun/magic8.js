'use strict';

const style = require('../../config/style');
const RESPONSES = Object.freeze([
  '✅ It is certain.',
  '✅ Without a doubt.',
  '✅ Yes, definitely.',
  '✅ Most likely.',
  '✅ Signs point to yes.',
  '🔮 Ask again later.',
  '🔮 Cannot predict now.',
  '🔮 Concentrate and ask again.',
  "❌ Don't count on it.",
  '❌ My reply is no.',
  '❌ My sources say no.',
  '❌ Very doubtful.',
  '❌ Outlook not so good.',
]);

module.exports = {
  commands: ['magic8'],
  description: 'Ask the magic 8-ball a yes/no question',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    const question = args.join(' ');
    if (!question) {
      return ctx.reply(style.renderError([
        'Magic 8-Ball',
        '',
        'Ask a yes/no question.',
        'Example: .magic8 Will I be rich?',
      ]));
    }

    const answer = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
    await ctx.reply(style.renderInfo([
      'Magic 8-Ball',
      '',
      `❓ ${question}`,
      '',
      answer,
    ]));
  },
};
