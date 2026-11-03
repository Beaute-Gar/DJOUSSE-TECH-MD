'use strict';

const config = require('../_partage/config');
const style = require('../../config/style');

module.exports = {
  commands: ['botsettings', 'config2'],
  description: 'View bot settings',
  permission: 'owner',
  run: async (sock, message, args, ctx) => {
    const value = (key, fallback = 'OFF') => String(process.env[key] || fallback);
    const lines = [
      '⚙️ Bot Settings',
      '',
      `Bot Name: ${config.botName}`,
      `Prefix: ${config.prefix}`,
      `Mode: ${config.selfMode ? 'self' : config.publicMode ? 'public' : 'private'}`,
      `Anti-Delete (Group): ${value('ANTIDELETE_GROUP')}`,
      `Anti-Delete (Private): ${value('ANTIDELETE_PRIVATE')}`,
      `Auto Status Seen: ${config.autoStatusSeen}`,
      `Auto Status React: ${config.autoStatusReact}`,
      `Always Online: ${config.alwaysOnline}`,
      `Auto Typing: ${config.autoTyping}`,
      `Anti-Link: ${value('ANTILINK')}`,
      `Anti-VV: ${value('ANTIVV')}`,
      `Debug: ${value('DEBUG')}`,
    ];
    ctx.reply(style.renderInfo(lines));
  },
};
