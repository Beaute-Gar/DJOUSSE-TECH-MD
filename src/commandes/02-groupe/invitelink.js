// @legacy-order {"sourceFile":"02-groupe/advanced-features.js","sourceOrder":4,"definitionIndex":12,"entryOrder":13}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['invitelink', 'groupinvite'],
  description: 'Get the group invite link (bot must be admin)',
  permission: 'admin',
  group: true,
  run: async (sock, message, args, ctx) => {
    try {
      const code = await sock.groupInviteCode(ctx.jid);
    const link = `https://chat.whatsapp.com/${code}`;
    const rendered = style.renderInfo([
      'Group Invite Link',
      '',
      link,
      '',
      'Share this link to invite people to the group.',
    ]).replace(style.toUnicode(link), link);
    return ctx.reply(rendered);
    } catch (error) {
      return ctx.reply(style.renderError([
        `Failed to get invite link. Make sure the bot is an admin: ${error.message}`,
      ]));
    }
  },
};
