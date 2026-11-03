'use strict';

const style = require('../../config/style');
const FACTS = Object.freeze([
  'A group of owls is called a parliament.',
  'Dolphins sleep with one eye open.',
  'A snail can sleep for three years.',
  "Elephants are the only animals that can't jump.",
  "A rhinoceros' horn is made of hair.",
  'Slugs have four noses.',
  'Koalas sleep up to 22 hours a day.',
  'A crocodile cannot stick its tongue out.',
  "Starfish don't have brains.",
  'Hummingbirds can fly backwards.',
  'Octopuses have three hearts.',
  'Cats have over 20 vocalizations.',
  'A flamingo can only eat with its head upside down.',
  'Sharks have been around longer than trees.',
  'Cows have best friends.',
]);

module.exports = {
  commands: ['animalfact', 'animalf'],
  description: 'Random animal fact',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
    await ctx.reply(style.renderInfo(['Animal Fact', '', `🐾 ${fact}`]));
  },
};
