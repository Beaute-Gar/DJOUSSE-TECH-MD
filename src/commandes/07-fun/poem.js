// @legacy-order {"sourceFile":"07-fun/entertainment.js","sourceOrder":85,"definitionIndex":4,"entryOrder":185}
'use strict';

const style = require('../../config/style');

const POEMS = [
  {
    title: 'Small Light',
    text: 'A little light against the night,\nCan guide a traveler home.',
  },
  {
    title: 'After Rain',
    text: 'The clouds move on, the gardens gleam,\nAnd rooftops hold the morning.',
  },
  {
    title: 'Open Road',
    text: 'One steady step, then one step more,\nCan take you somewhere new.',
  },
  {
    title: 'Quiet',
    text: 'The world grows still; the stars appear,\nAnd patient thoughts take shape.',
  },
  {
    title: 'New Day',
    text: 'The dawn arrives without a sound,\nAnd offers room to begin.',
  },
];

module.exports = {
  commands: ['poem', 'poetry'],
  description: 'Get a short original poem',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const poem = POEMS[Math.floor(Math.random() * POEMS.length)];
    await ctx.reply(style.renderInfo([`📜 ${poem.title}`, '', poem.text]));
  },
};
