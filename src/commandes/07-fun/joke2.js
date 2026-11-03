'use strict';

const style = require('../../config/style');
const JOKES = Object.freeze([
  "I'm afraid for the calendar. Its days are numbered. 📅",
  'What do you call a fish without eyes? A fsh. 🐟',
  "I only know 25 letters of the alphabet. I don't know y. 🤷",
  'What did the ocean say to the beach? Nothing, it just waved. 🌊',
  "Why don't oysters share? Because they're shellfish. 🦪",
  'What do you call a lazy kangaroo? A pouch potato. 🦘',
  'I used to hate facial hair, but then it grew on me. 🧔',
  'What did the buffalo say when his son left? Bison. 🦬',
  'Why did the golfer bring two pairs of pants? In case he got a hole in one. ⛳',
  'What do you call a fake noodle? An impasta. 🍝',
  'What do you call a bear in the rain? A drizzly bear. 🐻',
  "Why don't scientists trust atoms? Because they make up everything! ⚛️",
  'What do you call a sleeping dinosaur? A dino-snore. 🦕',
  "I'm on a seafood diet. I see food and I eat it. 🍔",
  'What does a nosey pepper do? Gets jalapeño business! 🌶️',
]);

module.exports = {
  commands: ['joke2', 'dadjoke'],
  description: 'Dad joke',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
    await ctx.reply(style.renderInfo(['Dad Joke', '', `👨 ${joke}`]));
  },
};
