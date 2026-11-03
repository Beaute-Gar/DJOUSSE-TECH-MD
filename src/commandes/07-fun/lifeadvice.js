'use strict';

const style = require('../../config/style');

const ADVICE = Object.freeze([
  "Don't compare your beginning to someone else's middle.",
  "It's okay to say no. Your well-being matters.",
  'Drink water regularly and take care of your body.',
  'Stop waiting for the perfect moment. Start with what you have.',
  'Learn to be comfortable being uncomfortable.',
  'Read more books. Each one offers a new perspective.',
  "Exercise can support both your body's and mind's well-being.",
  'Sleep is not a luxury; it is a necessity.',
  'Be kind to strangers. You never know what they are going through.',
  'Invest in experiences, not just things.',
  'Take breaks. Burnout is not a badge of honor.',
  'Make time to connect with people who matter to you.',
  'Ask for help when you need it.',
  'Celebrate small progress, not only big achievements.',
  'You can change direction when something no longer works for you.',
]);

module.exports = {
  commands: ['lifeadvice'],
  description: 'Share a general life-advice suggestion',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const advice = ADVICE[Math.floor(Math.random() * ADVICE.length)];
    await ctx.reply(style.renderInfo(['Life Advice', '', advice]));
  },
};
