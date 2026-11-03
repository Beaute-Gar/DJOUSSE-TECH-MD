'use strict';

const style = require('../../config/style');
const FACTS = Object.freeze([
  'Honey is the only food that never spoils.',
  'Apples float in water because they are 25% air.',
  "Peanuts aren't nuts — they're legumes.",
  "Bananas are berries, but strawberries aren't.",
  'Cashews grow on the bottom of a fruit.',
  'Chocolate was once used as currency.',
  'Carrots were originally purple.',
  'Potatoes were the first food grown in space.',
  'A single spaghetti noodle is called a spaghetto.',
  'Ketchup was once sold as medicine.',
  'The most expensive pizza costs $12,000.',
  'Cucumbers are 95% water.',
  'Popsicles were invented by an 11-year-old.',
  'There are over 7,500 varieties of apples.',
  'The average American eats 23 pounds of pizza per year.',
]);

module.exports = {
  commands: ['foodfact', 'foodf'],
  description: 'Random food fact',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
    await ctx.reply(style.renderInfo(['Food Fact', '', `🍽️ ${fact}`]));
  },
};
