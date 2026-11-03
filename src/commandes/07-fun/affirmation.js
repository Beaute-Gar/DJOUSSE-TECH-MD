'use strict';

const style = require('../../config/style');

const AFFIRMATIONS = Object.freeze([
  'I am worthy of love and respect.',
  'I am capable of working toward my goals.',
  'I choose to notice what I am grateful for today.',
  'I am growing and evolving every day.',
  'I am enough, just as I am.',
  'I have the power to make positive changes.',
  'I am resilient and can face challenges one step at a time.',
  'I deserve to pursue success and happiness.',
  'My potential is still unfolding.',
  'I am surrounded by people who care about me.',
  'I trust myself to learn from the journey.',
  'I can make a difference in the world around me.',
  'I radiate confidence and positivity.',
  'Today I choose joy over worry.',
  'I am allowed to rest and take care of myself.',
]);

module.exports = {
  commands: ['affirmation', 'affirm'],
  description: 'Share a positive daily affirmation',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const affirmation = AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)];
    await ctx.reply(style.renderInfo(['Daily Affirmation', '', affirmation]));
  },
};
