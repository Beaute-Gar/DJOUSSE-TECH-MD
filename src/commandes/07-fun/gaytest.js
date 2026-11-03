'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['gaytest', 'gay'],
  description: 'Gay meter (for fun)',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const score = Math.floor(Math.random() * 101);
    const bar = '█'.repeat(Math.floor(score / 10)) + '░'.repeat(10 - Math.floor(score / 10));
    await ctx.reply(style.renderInfo([
      'Gay Meter',
      '',
      `🏳️‍🌈 [${bar}] ${score}%`,
      '',
      'This is just for fun! Love is love 💕',
    ]));
  },
};
