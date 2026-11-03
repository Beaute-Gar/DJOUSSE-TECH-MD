'use strict';

const style = require('../../config/style');
const FACTS = Object.freeze([
  'A day on Venus is longer than a year on Venus.',
  'There are more stars in the universe than grains of sand on Earth.',
  'Neutron stars can spin 600 times per second.',
  'Space is completely silent.',
  'The footprints on the Moon will last for 100 million years.',
  'One million Earths could fit inside the Sun.',
  'If two pieces of metal touch in space, they bond permanently.',
  'The largest known star is 1,700 times bigger than our Sun.',
  "There's a planet made of diamonds twice the size of Earth.",
  "Saturn would float in water because it's mostly gas.",
  'A light year is about 6 trillion miles.',
  'The Milky Way is moving through space at 1.3 million mph.',
  'Mars sunsets are blue.',
  'Jupiter has 95 known moons.',
  'The ISS travels at about 17,500 mph.',
]);

module.exports = {
  commands: ['spacefact', 'spacef'],
  description: 'Random space fact',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
    await ctx.reply(style.renderInfo(['Space Fact', '', `🚀 ${fact}`]));
  },
};
