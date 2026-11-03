'use strict';

const style = require('../../config/style');
const OPTIONS = Object.freeze([
  ['Pizza', 'Burger'],
  ['Cat', 'Dog'],
  ['Morning', 'Night'],
  ['Beach', 'Mountain'],
  ['Netflix', 'YouTube'],
  ['Coffee', 'Tea'],
  ['Summer', 'Winter'],
  ['Book', 'Movie'],
  ['Android', 'iPhone'],
  ['Twitter', 'Instagram'],
  ['Call', 'Text'],
  ['Rain', 'Snow'],
  ['Cake', 'Pie'],
  ['Batman', 'Superman'],
  ['Spotify', 'Apple Music'],
]);

module.exports = {
  commands: ['thisorthat', 'tot'],
  description: 'This or that',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const [optionA, optionB] = OPTIONS[Math.floor(Math.random() * OPTIONS.length)];
    await ctx.reply(style.renderInfo([
      'This or That',
      '',
      `🅰️ ${optionA}`,
      '',
      'OR',
      '',
      `🅱️ ${optionB}`,
      '',
      'What do you prefer?',
    ]));
  },
};
