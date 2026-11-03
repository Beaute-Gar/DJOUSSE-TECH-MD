'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['bio', 'updatebio'],
  description: 'Update bot bio/status',
  permission: 'owner',
  run: async (sock, message, args, ctx) => {
    const bio = args.join(' ');
    if (!bio) return ctx.reply(style.renderError(['Usage: .setbio <new bio text>']));
    try {
      await sock.updateProfileStatus(bio);
      ctx.reply(style.renderInfo([`✅ Bio updated to: "${bio}"`]));
    } catch (error) {
      ctx.reply(style.renderError([`Failed: ${error.message}`]));
    }
  },
};
