// @legacy-order {"sourceFile":"05-outils/utility-tools.js","sourceOrder":265,"definitionIndex":4,"entryOrder":726}
'use strict';

const style = require('../../config/style');

const TIME_ZONES = [
  ['🇰🇪 Nairobi', 'Africa/Douala'],
  ['🇬🇧 London', 'Europe/London'],
  ['🇺🇸 New York', 'America/New_York'],
  ['🇺🇸 LA', 'America/Los_Angeles'],
  ['🇯🇵 Tokyo', 'Asia/Tokyo'],
  ['🇮🇳 Mumbai', 'Asia/Kolkata'],
  ['🇦🇺 Sydney', 'Australia/Sydney'],
  ['🇦🇪 Dubai', 'Asia/Dubai'],
  ['🇧🇷 São Paulo', 'America/Sao_Paulo'],
  ['🇨🇳 Beijing', 'Asia/Shanghai'],
];

module.exports = {
  commands: ['tz', 'worldclock'],
  description: 'Show the current time in major time zones',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const lines = TIME_ZONES.map(([name, timeZone]) => {
      const time = new Date().toLocaleTimeString('en-US', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      return `${name}: ${time}`;
    });

    return ctx.reply(style.renderInfo(['World Clock', '', ...lines]));
  },
};
