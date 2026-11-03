'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['pig', 'piglatin'],
  description: 'Convert to Pig Latin',
  permission: 'public',
  run: async (sock, message, args, { jid, contextInfo, prefix }) => {
    const text = args.join(' ');
    if (!text) {
      return sock.sendMessage(jid, {
        text: style.renderSaisie(`Usage: ${prefix || '.'}pig <text>`),
        contextInfo,
      }, { quoted: message });
    }

    const converted = text.split(' ').map((word) => {
      const match = word.match(/^([^aeiouAEIOU]*)(.*)/);
      return `${match[2]}${match[1]}ay`;
    }).join(' ');

    await sock.sendMessage(jid, {
      text: style.renderInfo([converted]),
      contextInfo,
    }, { quoted: message });
  },
};
