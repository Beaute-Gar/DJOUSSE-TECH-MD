'use strict';

const style = require('../../config/style');
const FACTS = Object.freeze([
  '111,111,111 × 111,111,111 = 12,345,678,987,654,321',
  'Zero is the only number that cannot be represented in Roman numerals.',
  'A "jiffy" is a real unit of time: 1/100th of a second.',
  'The number 4 is the only number with the same number of letters as its value.',
  'If you shuffle a deck of cards, the order has likely never existed before.',
  'Pi has been calculated to over 100 trillion digits.',
  'A googol is 10^100. A googolplex is 10^googol.',
  'The word "hundred" derives from the Norse word "hundrath" meaning 120.',
  '2520 is the smallest number divisible by all numbers from 1 to 10.',
  'Every odd number has the letter "e" in it.',
  'The symbol for division (÷) is called an obelus.',
  'Forty is the only number with letters in alphabetical order.',
  'From 0 to 1000, only "one thousand" has the letter "a".',
  'An icosagon has 20 sides.',
  'A palindrome number reads the same backward and forward.',
]);

module.exports = {
  commands: ['mathfact', 'mathf'],
  description: 'Random math fact',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
    await ctx.reply(style.renderInfo(['Math Fact', '', `🔢 ${fact}`]));
  },
};
