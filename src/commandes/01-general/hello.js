'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['hello'],
  description: 'Simple hello test command',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const received = args.length ? args.join(', ') : 'none';
    await ctx.reply(style.renderInfo([
      'Hello!',
      `Arguments received: ${received}`,
    ]));
  },
};
