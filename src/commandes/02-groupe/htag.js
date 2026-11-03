'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['htag', 'stag'],
  description: "Silently mention all group members — they get notified but are not visibly tagged",
  usage: '.htag <message>',
  permission: 'admin',
  group: true,
  private: false,
  run: async (sock, message, args, ctx) => {
    const { jid, isAdmin, isBotAdmin, contextInfo, groupMetadata, theme } = ctx;
    const sendError = (text) => sock.sendMessage(
      jid,
      { text: style.renderError([text]), contextInfo },
      { quoted: message }
    );

    if (!isAdmin && !message.key?.fromMe) {
      return sendError(theme?.admin || '⛔ Only group admins can use this command.');
    }
    if (!isBotAdmin) {
      return sendError(theme?.botAdmin || '⛔ I need to be an admin to use hidetag.');
    }
    if (!args.length) {
      return sendError('❌ *Usage:* `.hidetag <message>`\n\nSends your message while silently notifying all members.');
    }

    const participants = groupMetadata?.participants || [];
    if (!participants.length) return sendError('❌ Could not fetch group members.');

    await sock.sendMessage(jid, {
      text: style.renderInfo([args.join(' ')]),
      mentions: participants.map((participant) => participant.id),
    });
  },
};
