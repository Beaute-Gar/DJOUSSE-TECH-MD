// @legacy-order {"sourceFile":"02-groupe/newsletter.js","sourceOrder":150,"definitionIndex":0,"entryOrder":449}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['channelinfo'],
  description: 'Get newsletter/channel information',
  permission: 'owner',
  group: false,
  private: true,
  run: async (sock, message, args, ctx) => {
    const target = args[0]?.trim();
    if (!target) {
      return ctx.reply(style.renderError([
        `Usage: ${ctx.prefix || '.'}channelinfo <newsletter_jid_or_invite_link>`,
      ]));
    }

    try {
      let key = target;
      let type = 'jid';
      if (target.includes('whatsapp.com/channel/')) {
        const match = target.match(/channel\/([A-Za-z0-9_-]+)/);
        if (!match) return ctx.reply(style.renderError(['Invalid invite link.']));
        key = match[1];
        type = 'invite';
      }

      const metadata = await sock.newsletterMetadata(type, key);
      if (!metadata) {
        return ctx.reply(style.renderError(['Could not fetch newsletter info.']));
      }
      return ctx.reply(style.renderInfo([
        'Newsletter Info',
        '',
        `Name: ${metadata.name || 'N/A'}`,
        `JID: ${metadata.id}`,
        `Subscribers: ${metadata.subscribers ?? 'N/A'}`,
        `Description: ${metadata.description || 'N/A'}`,
        `Verification: ${metadata.verification || 'none'}`,
      ]));
    } catch (error) {
      return ctx.reply(style.renderError([`Failed to fetch info: ${error.message}`]));
    }
  },
};
