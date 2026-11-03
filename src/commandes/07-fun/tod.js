'use strict';

const style = require('../../config/style');
const TRUTHS = Object.freeze([
  "What's the most embarrassing thing you've ever done?",
  "What's the biggest lie you've ever told?",
  'Who was your first crush?',
  "What's one secret you've never told anyone?",
  "What's the most childish thing you still do?",
  "What's your biggest fear?",
  'Have you ever cheated on a test?',
  "What's the weirdest dream you've ever had?",
  "What's the most embarrassing thing in your search history?",
  'Who here would you most like to go on a date with?',
]);
const DARES = Object.freeze([
  'Send a voice note singing your favorite song 🎵',
  'Change your profile picture to a funny face for 1 hour 😄',
  "Text your crush 'I like you' and show us the reply",
  'Do 20 push-ups right now 💪',
  'Send a screenshot of your most recent conversation',
  'Send a selfie with a funny face 🤪',
  "Write 'I am a potato 🥔' in your status for 10 minutes",
  "Send a voice message saying 'I love DJOUSSE TECH'",
  'Call someone and sing happy birthday',
  'Let the group rename you for the next 30 minutes',
]);

module.exports = {
  commands: ['tod'],
  description: 'Truth or Dare game',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    if (Math.random() < 0.5) {
      const truth = TRUTHS[Math.floor(Math.random() * TRUTHS.length)];
      return ctx.reply(style.renderInfo(['Truth or Dare → Truth', '', truth]));
    }

    const dare = DARES[Math.floor(Math.random() * DARES.length)];
    await ctx.reply(style.renderInfo(['Truth or Dare → Dare', '', dare]));
  },
};
