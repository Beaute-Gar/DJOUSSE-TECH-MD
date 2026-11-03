// @legacy-order {"sourceFile":"02-groupe/advanced-features.js","sourceOrder":4,"definitionIndex":11,"entryOrder":12}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['admins', '@admins'],
  description: 'Mention all group admins',
  permission: 'public',
  group: true,
  run: async (sock, message, args, ctx) => {
    let metadata;
    try {
      metadata = ctx.groupMetadata || await sock.groupMetadata(ctx.jid);
    } catch {
      return ctx.reply(style.renderError(['Could not fetch group information.']));
    }

    if (!metadata) {
      return ctx.reply(style.renderError(['Could not fetch group information.']));
    }

    const admins = (metadata.participants || []).filter(participant => participant.admin);
    if (admins.length === 0) {
      return ctx.reply(style.renderInfo(['No admins found in this group.']));
    }

    const reason = args.join(' ').trim() || 'Attention needed';
    const mentions = admins.map(participant => participant.id);
    return ctx.reply(style.renderInfo([
      'Admins mentioned',
      '',
      `Reason: ${reason}`,
      '',
      ...admins.map(({ id }) => `• @${id.split('@')[0]}`),
    ]), mentions);
  },
};
