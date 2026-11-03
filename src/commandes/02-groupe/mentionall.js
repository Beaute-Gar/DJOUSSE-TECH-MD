'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['mentionall', 'pingall'],
  description: "Mention all members in the group",
  usage: '.mentionall [message]',
  permission: 'admin',
  group: true,
  private: false,
  run: async (sock, message, args, ctx) => {
    const { groupMetadata, jid, isAdmin, isBotAdmin, contextInfo, theme } = ctx;
    const sendError = (text) => sock.sendMessage(
      jid,
      { text: style.renderError([text]), contextInfo },
      { quoted: message }
    );

    if (!isAdmin && !message.key?.fromMe) {
      return sendError(theme?.admin || '⛔ Only group admins can use this command.');
    }
    if (!isBotAdmin) {
      return sendError(theme?.botAdmin || '⛔ I need to be an admin to tag all members.');
    }

    const participants = groupMetadata?.participants || [];
    if (!participants.length) return sendError('❌ Could not fetch group members.');

    const header = args.join(' ').trim() || '📢 *Attention Everyone!*';
    const mentions = participants.map((participant) => participant.id);
    const memberLines = participants
      .map((participant) => `• @${participant.id.split('@')[0]}`)
      .join('\n');
    const text = `${header}\n\n${memberLines}\n\n👥 *${participants.length} members tagged*`;

    await sock.sendMessage(jid, {
      text: style.renderInfo([text]),
      mentions,
    }, { quoted: message });
  },
};
