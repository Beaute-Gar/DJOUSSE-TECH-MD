// @legacy-order {"sourceFile":"10-divers/schedule.js","sourceOrder":192,"definitionIndex":0,"entryOrder":567}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['remind2', 'setmsg'],
  description: 'Schedule a message to be sent after a delay',
  permission: 'owner',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    const delay = args[0];
    const text = args.slice(1).join(' ');
    if (!delay || !text) {
      return ctx.reply(style.renderError([
        'Usage: .schedule <delay> <message>',
        'Delay formats: 30s, 5m, 1h',
        'Example: .schedule 5m Good morning everyone!',
      ]));
    }

    const match = delay.match(/^(\d+)(s|m|h)$/);
    if (!match) return ctx.reply(style.renderError(['Invalid delay. Use: 30s, 5m, 1h']));

    const value = Number.parseInt(match[1], 10);
    const duration = value * (match[2] === 's' ? 1000 : match[2] === 'm' ? 60000 : 3600000);
    if (duration > 24 * 3600000) {
      return ctx.reply(style.renderError(['Maximum delay is 24 hours.']));
    }

    const target = ctx.groupId || ctx.sender;
    await ctx.reply(style.renderInfo([
      'Message scheduled!',
      `Target: ${ctx.groupId ? 'This group' : 'You'}`,
      `Delay: ${delay}`,
      `Message: ${text}`,
    ]));
    setTimeout(async () => {
      try {
        await ctx.sock.sendMessage(target, {
          text: style.renderInfo(['Scheduled Message', '', text]),
        });
      } catch (error) {
        console.warn('[Schedule] Failed to send scheduled message:', error.message);
      }
    }, duration);
  },
};
