// @legacy-order {"sourceFile":"07-fun/emoji-games.js","sourceOrder":82,"definitionIndex":6,"entryOrder":170}
'use strict';
const style = require('../../config/style');
const state = require('./_quiz-state');
const COUNTRIES = [
  { country: 'Kenya', capital: 'Nairobi' }, { country: 'Japan', capital: 'Tokyo' },
  { country: 'France', capital: 'Paris' }, { country: 'Brazil', capital: 'Brasília' },
  { country: 'Australia', capital: 'Canberra' }, { country: 'Egypt', capital: 'Cairo' },
  { country: 'Germany', capital: 'Berlin' }, { country: 'Italy', capital: 'Rome' },
  { country: 'Canada', capital: 'Ottawa' }, { country: 'India', capital: 'New Delhi' },
  { country: 'Nigeria', capital: 'Abuja' }, { country: 'South Africa', capital: 'Pretoria' },
  { country: 'Tanzania', capital: 'Dodoma' }, { country: 'Uganda', capital: 'Kampala' },
  { country: 'Ethiopia', capital: 'Addis Ababa' }, { country: 'Spain', capital: 'Madrid' },
  { country: 'China', capital: 'Beijing' }, { country: 'Russia', capital: 'Moscow' },
  { country: 'Turkey', capital: 'Ankara' }, { country: 'Thailand', capital: 'Bangkok' },
];

module.exports = {
  commands: ['capitalquiz', 'cq'],
  description: 'Guess the capital city',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const question = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
    state[`${ctx.from}_cq`] = question.capital;
    await ctx.reply(style.renderOutgoingText(
      `🏛️ *Guess the Capital!*\n\nWhat is the capital of *${question.country}*?\n\nReply with .capitalanswer <city>`
    ));
  },
};
