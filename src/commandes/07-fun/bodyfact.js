'use strict';

const style = require('../../config/style');
const FACTS = Object.freeze([
  'Your body has about 100,000 miles of blood vessels.',
  'The human nose can detect over 1 trillion scents.',
  'Humans are the only animals that blush.',
  'Your bones are stronger than steel.',
  'The fastest muscles in your body are in your eyes.',
  'Your stomach gets a new lining every 3-4 days.',
  "Humans glow in the dark, but it's too faint to see.",
  'Your brain generates enough electricity to power a lightbulb.',
  'The human eye can distinguish about 10 million different colors.',
  'Your heart beats about 100,000 times per day.',
  'Fingernails grow about 4 times faster than toenails.',
  'The acid in your stomach is strong enough to dissolve metal.',
  'Humans shed about 600,000 skin particles per hour.',
  'Your body produces about 25 million new cells each second.',
  'The cornea is the only part of the body with no blood supply.',
]);

module.exports = {
  commands: ['bodyfact', 'bodyf'],
  description: 'Random human body fact',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
    await ctx.reply(style.renderInfo(['Human Body Fact', '', `🫀 ${fact}`]));
  },
};
