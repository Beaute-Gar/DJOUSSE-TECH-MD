'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['iq', 'iqtest'],
  description: 'IQ test (for fun)',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const name = args.join(' ') || 'Your';
    const iq = Math.floor(Math.random() * 101) + 80;
    const result = iq > 160
      ? 'Genius level! 🎓'
      : iq > 130
        ? 'Very gifted! 📚'
        : iq > 110
          ? 'Above average! 👍'
          : iq > 90
            ? 'Average intelligence 🙂'
            : 'Hmm... maybe study more? 📖';
    await ctx.reply(style.renderInfo([
      'IQ Test',
      '',
      `${name} IQ: ${iq}`,
      '',
      result,
      '',
      'This is just for fun!',
    ]));
  },
};
