'use strict';

const style = require('../../config/style');

const ANSWERS = [
  'It is certain.', 'It is decidedly so.', 'Without a doubt.', 'Yes definitely.',
  'You may rely on it.', 'As I see it, yes.', 'Most likely.', 'Outlook good.',
  'Yes.', 'Signs point to yes.', 'Reply hazy, try again.', 'Ask again later.',
  'Better not tell you now.', 'Cannot predict now.', 'Concentrate and ask again.',
  "Don't count on it.", 'My reply is no.', 'My sources say no.',
  'Outlook not so good.', 'Very doubtful.',
];

module.exports = {
  commands: ['magicball', 'eightball'],
  description: 'Magic 8-ball',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    if (!args.length) {
      return ctx.reply(style.renderError(['Usage', '', '.8ball <question>']));
    }

    const answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
    await ctx.reply(style.renderInfo([
      'Magic 8-Ball',
      '',
      `❓ ${args.join(' ')}`,
      `🔮 ${answer}`,
    ]));
  },
};
