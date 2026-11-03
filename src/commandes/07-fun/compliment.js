'use strict';

const style = require('../../config/style');

const COMPLIMENTS = [
  'You make the world a better place just by being in it. 🌟',
  'Your smile could light up the darkest room. ✨',
  'You have an incredible ability to make everyone feel welcome.',
  'Your kindness is a rare and beautiful gift to the world. 🎁',
  'You are more resilient than you give yourself credit for. 💪',
  'The way you carry yourself inspires people around you.',
  'Your creativity is genuinely impressive. 🎨',
  'You handle challenges with such grace and strength.',
  'People are lucky to have you in their lives. 🍀',
  'Your sense of humor brings so much joy to others. 😄',
  'You have a heart of gold. 💛',
  "You're doing better than you think. Keep going!",
  'Your intelligence and thoughtfulness are truly remarkable.',
  'You make hard things look easy — that\'s a real talent.',
  'Being around you feels like a breath of fresh air. 🌬️',
  'You bring out the best in the people around you. 🌸',
  'Your dedication and work ethic are truly admirable. 🏆',
  'You have a beautiful mind and an even more beautiful soul.',
  'The world is genuinely better with you in it. 🌍',
  'You are exactly who you need to be. 🔥',
];

module.exports = {
  commands: ['compliment', 'comp'],
  description: 'Send a random compliment',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    const compliment = COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)];
    const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const target = mentions.length
      ? `@${mentions[0].split('@')[0]}, ${compliment.charAt(0).toLowerCase()}${compliment.slice(1)}`
      : compliment;

    await ctx.reply(style.renderInfo(['Compliment', '', target]), mentions);
  },
};
