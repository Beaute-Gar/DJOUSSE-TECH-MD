'use strict';

const style = require('../../config/style');
const FACTS = Object.freeze([
  'Golf balls have an average of 336 dimples.',
  'A tennis ball is only in play for about 20 minutes in a match.',
  "The Olympic flag's colors appear on every national flag.",
  'Soccer is played by 250 million people in 200+ countries.',
  'The longest tennis match lasted 11 hours and 5 minutes.',
  'Basketball was invented using peach baskets.',
  'The first World Cup was held in 1930 in Uruguay.',
  "Usain Bolt's top speed was 27.8 mph.",
  'Cricket matches can last up to 5 days.',
  'The NBA court is 94 feet long.',
  'Table tennis balls travel at speeds up to 100 mph.',
  'The first Olympics had only 9 sports.',
  'A regulation NBA basketball must be 29.5 inches in circumference.',
  'The Tour de France covers about 2,200 miles.',
  'The most red cards in a single match is 36.',
]);

module.exports = {
  commands: ['sportfact', 'sportf'],
  description: 'Random sport fact',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
    await ctx.reply(style.renderInfo(['Sport Fact', '', `⚽ ${fact}`]));
  },
};
