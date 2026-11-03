'use strict';

const os = require('node:os');
const config = require('../../config/config');
const style = require('../../config/style');
const { formatDuration } = require('../../guard/utils/time');

module.exports = {
  commands: ['runtime'],
  description: 'Show bot uptime and system stats',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const uptime = formatDuration(process.uptime() * 1000);
    const totalMemory = (os.totalmem() / 1073741824).toFixed(2);
    const freeMemory = (os.freemem() / 1073741824).toFixed(2);
    const cpu = os.cpus()[0]?.model || 'Unknown CPU';
    const timestamp = Number(message.messageTimestamp || 0) * 1000;
    const latency = timestamp > 0 ? Math.max(0, Date.now() - timestamp) : 0;

    await ctx.reply(style.renderInfo([
      `BOT : ${config.botName}`,
      `DISPONIBILITÉ : ${uptime}`,
      `LATENCE : ${latency} ms`,
      `CPU : ${cpu}`,
      `PLATEFORME : ${os.platform().toUpperCase()}`,
      `MÉMOIRE LIBRE : ${freeMemory} / ${totalMemory} GB`,
      style.signature(),
    ]));
  },
};
