'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['flip'],
  description: 'Flip a coin or roll dice',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    const result = Math.random() < 0.5 ? 'HEADS 🪙' : 'TAILS 💿';
    await ctx.reply(style.renderInfo(['Coin Flip Result', '', `${result}!`]));
  },
};
