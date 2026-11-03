'use strict';

const style = require('../../config/style');
const FACTS = Object.freeze([
  'The Lion King was originally called "King of the Jungle."',
  'The word "mafia" is never spoken in The Godfather.',
  'Toy Story was the first fully CGI feature film.',
  'James Bond has killed over 350 people across all films.',
  'The longest movie ever made is 857 hours long.',
  'The Wizard of Oz ruby slippers sold for $2 million.',
  'Psycho was the first movie to show a toilet flushing.',
  'Avatar took 15 years to develop.',
  'The Titanic film cost more to make than the actual Titanic.',
  'Sean Connery wore a toupee in every Bond film.',
  'E.T. was almost cut because it went over budget.',
  'The sound of the T-Rex in Jurassic Park is a baby elephant.',
  'The Matrix used 14,000 extras.',
  "Disney's Frozen was in development for 70 years.",
  'Keanu Reeves gave $75 million of his Matrix salary to the special effects team.',
]);

module.exports = {
  commands: ['moviefact', 'movief'],
  description: 'Random movie fact',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
    await ctx.reply(style.renderInfo(['Movie Fact', '', `🎬 ${fact}`]));
  },
};
