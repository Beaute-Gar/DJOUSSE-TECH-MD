// @legacy-order {"sourceFile":"07-fun/games.js","sourceOrder":94,"definitionIndex":18,"entryOrder":236}
'use strict';

const style = require('../../config/style');

const ROASTS = [
  'You bring everyone joy—especially when you share your snacks.',
  'Your sense of direction is so creative that maps get confused.',
  'You have the confidence of someone who clicked “remind me tomorrow” for a year.',
  'You are proof that a little chaos can be very entertaining.',
  'Your brain has too many tabs open, and somehow they are all playing music.',
  'You are not late; you are just giving everyone extra time to miss you.',
  'Your secret talent is making a simple story wonderfully complicated.',
  'You have the energy of a phone at 2% that refuses to find a charger.',
];

module.exports = {
  commands: ['roast', 'roastme'],
  description: 'Get a friendly random roast',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const roast = ROASTS[Math.floor(Math.random() * ROASTS.length)];
    await ctx.reply(style.renderInfo(['Friendly Roast', '', roast, '', 'Just playing—keep it kind!']));
  },
};
