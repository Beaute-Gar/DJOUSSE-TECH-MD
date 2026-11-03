'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['restart2', 'reboot'],
  description: 'Restart bot',
  permission: 'owner',
  run: async (sock, message, args, ctx) => {
    await ctx.reply(style.renderInfo(['♻️ Restarting bot in 3 seconds...']));
    setTimeout(() => process.exit(0), 3000);
  },
};
