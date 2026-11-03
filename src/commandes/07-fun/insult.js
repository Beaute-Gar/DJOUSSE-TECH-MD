'use strict';

const style = require('../../config/style');

const ROASTS = Object.freeze([
  "You're like a loading bar stuck at 99%: mysterious and oddly confident.",
  'Your jokes arrive fashionably late, but at least they make an entrance.',
  'You bring main-character energy to a side-quest kind of day.',
  'Your plans have more plot twists than a mystery novel.',
  'You could turn a quick story into a director’s cut.',
  'Your sense of direction is more of a creative suggestion.',
  'You are proof that chaos can have excellent timing.',
  'Your attention span just waved hello from another tab.',
]);

module.exports = {
  commands: ['insult', 'friendlyinsult'],
  description: 'Share a light-hearted friendly roast',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const roast = ROASTS[Math.floor(Math.random() * ROASTS.length)];
    await ctx.reply(style.renderInfo(['Friendly Roast', '', roast, '', 'Just playing—keep it kind!']));
  },
};
