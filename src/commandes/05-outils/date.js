// @legacy-order {"sourceFile":"05-outils/utility-tools.js","sourceOrder":265,"definitionIndex":0,"entryOrder":722}
'use strict';

const style = require('../../config/style');

const zones = {
  EAT: 'Africa/Douala',
  EST: 'America/New_York',
  PST: 'America/Los_Angeles',
  GMT: 'Europe/London',
  IST: 'Asia/Kolkata',
  JST: 'Asia/Tokyo',
};

module.exports = {
  commands: ['date', 'today'],
  description: 'Current date and time',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const label = zones[args[0]?.toUpperCase()] ? args[0].toUpperCase() : 'EAT';
    const dateTime = new Date().toLocaleString('en-US', {
      timeZone: zones[label],
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    return ctx.reply(style.renderInfo([`📅 Date & Time (${label})\n\n${dateTime}`]));
  },
};
