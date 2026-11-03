'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['fakephone', 'phone'],
  description: 'Generate a fictional example phone number',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const suffix = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    await ctx.reply(style.renderInfo([
      'Random Phone',
      '',
      `+1 (202) 555-01${suffix}`,
      '',
      'Fictional example',
    ]));
  },
};
