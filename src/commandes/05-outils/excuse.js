'use strict';

const style = require('../../config/style');

const EXCUSES = Object.freeze([
  'My dog ate my homework... and my phone. 🐕',
  "I was abducted by aliens and they didn't have WiFi. 👽",
  'I got lost in my own neighborhood. 🗺️',
  'My alarm clock was on vacation. ⏰',
  'I was saving a cat from a tree. 🐱',
  'The internet was down in my entire country. 🌐',
  'I was struck by a meteorite... a very small one. ☄️',
  'My car keys were swallowed by a whale. 🐋',
  'I had a staring contest with my reflection and lost. 🪞',
  'I accidentally time-traveled to next week. ⏳',
  'My shadow went the wrong way and I had to follow it. 👤',
  'I was too busy being awesome. 😎',
  "A butterfly landed on my nose and I didn't want to disturb it. 🦋",
  'My horoscope said to stay home. ♈',
  'I was doing important research... on memes. 📱',
]);

module.exports = {
  commands: ['excuse', 'randomexcuse'],
  description: 'Generate a random humorous excuse',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const excuse = EXCUSES[Math.floor(Math.random() * EXCUSES.length)];
    await ctx.reply(style.renderInfo(['Random Excuse', '', excuse]));
  },
};
