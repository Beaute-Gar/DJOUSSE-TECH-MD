'use strict';

const style = require('../../config/style');

const TIME_ZONES = Object.freeze({
  nairobi: 'Africa/Nairobi',
  kenya: 'Africa/Nairobi',
  douala: 'Africa/Douala',
  cameroon: 'Africa/Douala',
  lagos: 'Africa/Lagos',
  cairo: 'Africa/Cairo',
  london: 'Europe/London',
  paris: 'Europe/Paris',
  berlin: 'Europe/Berlin',
  dubai: 'Asia/Dubai',
  india: 'Asia/Kolkata',
  delhi: 'Asia/Kolkata',
  tokyo: 'Asia/Tokyo',
  japan: 'Asia/Tokyo',
  beijing: 'Asia/Shanghai',
  china: 'Asia/Shanghai',
  'new york': 'America/New_York',
  newyork: 'America/New_York',
  losangeles: 'America/Los_Angeles',
  sydney: 'Australia/Sydney',
  australia: 'Australia/Sydney',
  brazil: 'America/Sao_Paulo',
  moscow: 'Europe/Moscow',
});

module.exports = {
  commands: ['time', 'clock'],
  description: 'Get the current time in a city or timezone',
  usage: '.time <city or timezone>',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const place = args.join(' ').trim() || 'Nairobi';
    const normalizedPlace = place.toLowerCase();
    const timezone = TIME_ZONES[normalizedPlace]
      || TIME_ZONES[normalizedPlace.replace(/\s+/g, '')]
      || place
      || 'Africa/Nairobi';

    let formatted;
    try {
      formatted = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(new Date());
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      await ctx.reply(style.renderError([
        `Unknown timezone: "${place}"`,
        '',
        'Try: Nairobi, London, Tokyo, New York, Dubai, Sydney',
      ]));
      return;
    }

    await ctx.reply(style.renderInfo([`Time in ${place}`, '', formatted, `Timezone: ${timezone}`]));
  },
};
