'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['mode2'],
  description: 'Change bot mode',
  permission: 'owner',
  run: async (sock, message, args, ctx) => {
    const mode = (args[0] || '').toLowerCase();
    if (!['public', 'private', 'both'].includes(mode)) {
      return ctx.reply(style.renderError(['Usage: .setmode public/private/both']));
    }
    process.env.MODE = mode;
    ctx.reply(style.renderInfo([`✅ Bot mode changed to: ${mode}`]));
  },
};
