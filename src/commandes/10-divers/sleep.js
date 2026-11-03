'use strict';
// @legacy-order {"sourceFile":"05-outils/health-fitness.js","sourceOrder":111,"definitionIndex":4,"entryOrder":318}

const style = require('../../config/style');

module.exports = {
  commands: ['sleep', 'sleepcalc'],
  description: 'Sleep calculator',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const cycles = [6, 7.5, 9];
    const input = args[0];
    if (!input) {
      const now = new Date();
      const wakeTimes = cycles.map((hours) => {
        const time = new Date(now.getTime() + hours * 60 * 60 * 1000);
        return `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')} (${hours}h)`;
      });
      return ctx.reply(style.renderInfo([
        '😴 *Sleep Calculator*',
        '',
        'If you sleep now, wake up at:',
        '',
        ...wakeTimes,
        '',
        'Or specify wake time: .sleep 06:30',
      ]));
    }

    const match = input.match(/^([01]?\d|2[0-3]):([0-5]\d)?$/);
    if (!match) {
      return ctx.reply(style.renderError(['Usage: .sleep <wake-time HH:MM>']));
    }
    const hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2] || '0', 10);
    const wakeTime = new Date();
    wakeTime.setHours(hours, minutes, 0, 0);
    const bedTimes = cycles.map((duration) => {
      const time = new Date(wakeTime.getTime() - duration * 60 * 60 * 1000);
      return `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')} (${duration}h sleep)`;
    });

    return ctx.reply(style.renderInfo([
      '😴 *Sleep Calculator*',
      '',
      `Wake up at ${hours}:${minutes.toString().padStart(2, '0')}`,
      '',
      'Go to bed at:',
      ...bedTimes,
    ]));
  },
};
