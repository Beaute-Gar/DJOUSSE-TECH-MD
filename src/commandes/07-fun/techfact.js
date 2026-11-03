'use strict';

const style = require('../../config/style');
const FACTS = Object.freeze([
  'The first computer virus was created in 1983.',
  'Email existed before the World Wide Web.',
  "92% of the world's currency is digital.",
  'The first website is still online: info.cern.ch',
  'Google was originally called "BackRub."',
  "The first iPhone didn't have an App Store.",
  'More people own a mobile phone than a toothbrush.',
  'The first computer mouse was made of wood.',
  'Amazon was originally a bookstore.',
  'The QWERTY keyboard was designed to slow typists down.',
  'The first SMS was sent in 1992 saying "Merry Christmas."',
  "WiFi doesn't stand for anything.",
  'The average person spends 7 hours a day on the internet.',
  'The first YouTube video was uploaded on April 23, 2005.',
  'There are approximately 1.13 billion websites on the internet.',
]);

module.exports = {
  commands: ['techfact', 'techf'],
  description: 'Random tech fact',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
    await ctx.reply(style.renderInfo(['Tech Fact', '', `💻 ${fact}`]));
  },
};
