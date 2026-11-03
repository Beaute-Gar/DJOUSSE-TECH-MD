'use strict';

const style = require('../../config/style');
const FACTS = Object.freeze([
  'Russia spans 11 time zones.',
  'Canada has more lakes than the rest of the world combined.',
  'Indonesia has the most volcanoes of any country.',
  'France is the most visited country in the world.',
  'Brazil has 60% of the Amazon rainforest.',
  'Australia is wider than the moon.',
  'Ethiopia follows a calendar that is 7 years behind the rest of the world.',
  'Norway once knighted a penguin.',
  'Iceland has no army, navy, or air force.',
  'New Zealand was the first country to give women the right to vote.',
  'Japan has more than 6,800 islands.',
  "Colombia is the world's largest producer of emeralds.",
  'Finland has more saunas than cars.',
  "Kenya contributes over 60% of the world's flower exports.",
  'Mongolia is the most sparsely populated country in the world.',
]);

module.exports = {
  commands: ['countryfact', 'countryf'],
  description: 'Random country fact',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
    await ctx.reply(style.renderInfo(['Country Fact', '', `🌍 ${fact}`]));
  },
};
