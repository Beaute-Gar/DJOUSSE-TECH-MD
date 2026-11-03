// @legacy-order {"sourceFile":"02-groupe/mutemember.js","sourceOrder":148,"definitionIndex":0,"entryOrder":444}
'use strict';

const style = require('../../config/style');

if (!(global.groupMutedMembers instanceof Map)) global.groupMutedMembers = new Map();

module.exports = {
  commands: ['mutelist'],
  description: 'Mute/unmute specific members (bot removes their messages automatically)',
  permission: 'admin',
  group: true,
  private: false,
  run: async (sock, message, args, ctx) => {
    if (!ctx.isAdmin) {
      return ctx.reply(style.renderError(['Only group admins can view muted members.']));
    }

    const muted = global.groupMutedMembers.get(ctx.jid);
    if (!muted?.size) {
      return ctx.reply(style.renderInfo(['No muted members in this group.']));
    }

    const members = [...muted];
    return ctx.reply(style.renderInfo([
      `Muted members (${members.length})`,
      '',
      ...members.map(jid => `• @${String(jid).split('@')[0]}`),
    ]), members);
  },
};
