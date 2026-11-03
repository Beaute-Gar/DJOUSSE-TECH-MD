'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['speed'],
  description: 'Bot speed test',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const start = Date.now();
    await ctx.reply(style.renderInfo(['Testing speed...']));
    const ping = Date.now() - start;
    const memory = process.memoryUsage();
    ctx.reply(style.renderInfo([
      '⚡ Speed Test',
      '',
      `Response: ${ping}ms`,
      `RAM: ${(memory.heapUsed / 1e6).toFixed(1)}MB / ${(memory.heapTotal / 1e6).toFixed(1)}MB`,
      `Uptime: ${Math.floor(process.uptime() / 60)}m`,
    ]));
  },
};
