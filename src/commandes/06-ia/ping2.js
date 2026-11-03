'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['ping2', 'ms'],
  description: 'Check bot response latency',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const start = Date.now();
    await ctx.safeSend({ text: style.renderInfo(['🏓 Pinging...']) }, { quoted: message });
    const latency = Date.now() - start;
    const memory = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    ctx.reply(style.renderInfo([
      '🏓 Pong!',
      '',
      `⚡ Latency: ${latency}ms`,
      '🤖 Status: Online',
      `💾 Memory: ${memory}MB`,
    ]));
  },
};
