'use strict';

const style = require('../../config/style');

const OPTIONS = [
  ['be able to fly', 'be able to turn invisible'],
  ['live without music', 'live without movies'],
  ['always be 10 minutes late', 'always be 20 minutes early'],
  ['have unlimited money', 'unlimited knowledge'],
  ['live in the ocean', 'live in space'],
  ['be famous', 'be rich'],
  ['control fire', 'control water'],
  ['read minds', 'see the future'],
  ['never sleep', 'never eat'],
  ['speak all languages', 'play all instruments'],
  ['live in the past', 'live in the future'],
  ['be a superhero', 'be a wizard'],
  ['have no phone', 'no computer'],
  ['be too hot', 'too cold'],
  ['travel to the past', 'travel to the future'],
];

module.exports = {
  commands: ['wouldyourather', 'wyr'],
  description: 'Would you rather',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const [optionA, optionB] = OPTIONS[Math.floor(Math.random() * OPTIONS.length)];
    await ctx.reply(style.renderInfo([
      'Would You Rather...',
      '',
      `🅰️ ${optionA}`,
      '',
      'or',
      '',
      `🅱️ ${optionB}`,
    ]));
  },
};
