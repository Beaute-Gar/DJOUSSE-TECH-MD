'use strict';

const style = require('../../config/style');

module.exports = {
    commands: ['met'],
    description: 'Show bot runtime and memory metrics',
    permission: 'public',
    group: true,
    private: true,

    run: async (sock, message, args, ctx) => {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        const memory = process.memoryUsage();
        const toMB = bytes => (bytes / 1024 / 1024).toFixed(1);
        const text =
            `📊 *Bot Metrics*\n\n` +
            `⏱ *Uptime:* ${hours}h ${minutes}m ${seconds}s\n` +
            `🧠 *Heap Used:* ${toMB(memory.heapUsed)} MB\n` +
            `🧠 *Heap Total:* ${toMB(memory.heapTotal)} MB\n` +
            `📦 *RSS:* ${toMB(memory.rss)} MB\n` +
            `🕐 *Time:* ${new Date().toLocaleString()}`;
        return ctx.reply(style.renderOutgoingText(text));
    },
};
