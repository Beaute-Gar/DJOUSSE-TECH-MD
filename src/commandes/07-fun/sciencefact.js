'use strict';

const style = require('../../config/style');
const FACTS = Object.freeze([
  'Hot water freezes faster than cold water (Mpemba effect).',
  'Bananas are radioactive.',
  'Honey never spoils.',
  'Lightning strikes Earth about 100 times per second.',
  'Your DNA could stretch from the Earth to the Sun and back 600 times.',
  'The human body contains about 37.2 trillion cells.',
  'Water can boil and freeze at the same time (triple point).',
  'A teaspoon of a neutron star weighs about 6 billion tons.',
  'The average human body carries more bacteria cells than human cells.',
  'Glass is actually a liquid that flows very slowly.',
  'Humans share 60% of their DNA with bananas.',
  'An octopus has blue blood.',
  'Sound travels 4.3 times faster in water than in air.',
  "A bolt of lightning is 5 times hotter than the sun's surface.",
  "The human brain uses 20% of the body's total energy.",
]);

module.exports = {
  commands: ['sciencefact', 'sciencef'],
  description: 'Random science fact',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
    await ctx.reply(style.renderInfo(['Science Fact', '', `🔬 ${fact}`]));
  },
};
