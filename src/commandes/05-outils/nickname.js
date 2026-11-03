'use strict';

const style = require('../../config/style');

const ADJECTIVES = Object.freeze([
  'Shadow', 'Dark', 'Blazing', 'Swift', 'Mystic', 'Cosmic', 'Wild', 'Silver',
  'Thunder', 'Crystal', 'Phantom', 'Noble', 'Fierce', 'Silent', 'Golden',
  'Crimson', 'Frost', 'Storm', 'Nova', 'Turbo',
]);
const NOUNS = Object.freeze([
  'Wolf', 'Phoenix', 'Dragon', 'Knight', 'Hawk', 'Ninja', 'Tiger', 'Ghost',
  'Warrior', 'Sage', 'Panther', 'Falcon', 'Viper', 'Raven', 'Legend', 'Blade',
  'Spark', 'Hunter', 'Star', 'Fury',
]);

module.exports = {
  commands: ['nickname', 'nick'],
  description: 'Generate a random nickname',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const number = Math.floor(Math.random() * 99);
    await ctx.reply(style.renderInfo(['Nickname Generator', '', `${adjective}${noun}${number}`]));
  },
};
