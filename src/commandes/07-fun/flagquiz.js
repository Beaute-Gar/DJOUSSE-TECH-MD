// @legacy-order {"sourceFile":"07-fun/emoji-games.js","sourceOrder":82,"definitionIndex":2,"entryOrder":166}
'use strict';
const style = require('../../config/style');
const state = require('./_quiz-state');
const FLAGS = [
  { flag: '🇰🇪', country: 'Kenya' }, { flag: '🇺🇸', country: 'USA' },
  { flag: '🇬🇧', country: 'United Kingdom' }, { flag: '🇯🇵', country: 'Japan' },
  { flag: '🇧🇷', country: 'Brazil' }, { flag: '🇫🇷', country: 'France' },
  { flag: '🇩🇪', country: 'Germany' }, { flag: '🇮🇹', country: 'Italy' },
  { flag: '🇨🇳', country: 'China' }, { flag: '🇮🇳', country: 'India' },
  { flag: '🇳🇬', country: 'Nigeria' }, { flag: '🇿🇦', country: 'South Africa' },
  { flag: '🇪🇬', country: 'Egypt' }, { flag: '🇦🇺', country: 'Australia' },
  { flag: '🇨🇦', country: 'Canada' }, { flag: '🇲🇽', country: 'Mexico' },
  { flag: '🇪🇸', country: 'Spain' }, { flag: '🇹🇷', country: 'Turkey' },
  { flag: '🇰🇷', country: 'South Korea' }, { flag: '🇷🇺', country: 'Russia' },
];

module.exports = {
  commands: ['flagquiz', 'fq'],
  description: 'Guess the country from flag',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const selected = FLAGS[Math.floor(Math.random() * FLAGS.length)];
    state[`${ctx.from}_fq`] = selected.country;
    await ctx.reply(style.renderOutgoingText(
      `🏳️ *Guess the Country!*\n\n${selected.flag} ${selected.flag} ${selected.flag}\n\nReply with .flaganswer <country>`
    ));
  },
};
