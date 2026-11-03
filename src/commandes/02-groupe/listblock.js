'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['listblock'],
  description: "Show the bot's blocked numbers list — owner only",
  permission: 'owner',
  group: false,
  private: true,
  run: async (sock, message, args, ctx) => {
    const { sender, contextInfo } = ctx;
    try {
      const blocklist = await sock.fetchBlocklist();
      if (!blocklist?.length) {
        return sock.sendMessage(
          sender,
          { text: style.renderInfo(['🔓 *No numbers are currently blocked*']), contextInfo },
          { quoted: message }
        );
      }

      const lines = blocklist.map((number) => `▢ @${number.split('@')[0]}`);
      const text = `🚫 *Blocked Numbers List*\n\n• Total: ${blocklist.length}\n\n┌───⊷\n${lines.join('\n')}\n└───────────`;
      return sock.sendMessage(sender, { text: style.renderInfo([text]), contextInfo }, { quoted: message });
    } catch (error) {
      console.error('[Blocklist]', error.message);
      return sock.sendMessage(
        sender,
        { text: style.renderError([`❌ Failed to fetch blocklist: ${error.message}`]), contextInfo },
        { quoted: message }
      );
    }
  },
};
