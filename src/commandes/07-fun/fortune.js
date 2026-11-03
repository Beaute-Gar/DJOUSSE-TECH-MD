'use strict';

const style = require('../../config/style');
const FORTUNES = Object.freeze([
  'A beautiful, smart, and loving person will be coming into your life.',
  'Your creativity will lead to great success.',
  'A pleasant surprise is waiting for you.',
  'Good things come to those who wait.',
  'Your hard work will soon pay off.',
  'An exciting opportunity lies ahead.',
  'A lifetime of happiness awaits you.',
  'The star of riches is shining upon you.',
  'Your ability to juggle many tasks will take you far.',
  'A faithful friend is a strong defense.',
  'You will receive unexpected good news.',
  'Your greatest fortune is the friends you have.',
  'The best is yet to come.',
  'Something wonderful is about to happen.',
  'Your talents will be recognized and rewarded.',
]);

module.exports = {
  commands: ['fortune', 'fortunecookie'],
  description: 'Fortune cookie',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const fortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
    await ctx.reply(style.renderInfo(['Fortune Cookie', '', `🥠 ${fortune}`]));
  },
};
