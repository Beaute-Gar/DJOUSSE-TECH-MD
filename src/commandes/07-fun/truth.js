'use strict';

const style = require('../../config/style');

const QUESTIONS = [
  'What is your biggest fear?',
  "What is the most embarrassing thing you've done?",
  'What is your biggest secret?',
  'Have you ever lied to your best friend?',
  "What is the worst gift you've received?",
  "What is something you've never told anyone?",
  'What is the most childish thing you still do?',
  'Have you ever cheated on a test?',
  'What is your biggest regret?',
  "What is the weirdest dream you've had?",
  'What is the most trouble you\'ve gotten into?',
  "What is a habit you're ashamed of?",
  'Have you ever pretended to be sick?',
  "What is the longest you've gone without showering?",
  'Who was your first crush?',
];

module.exports = {
  commands: ['truth', 'truthq'],
  description: 'Truth question',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const question = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    await ctx.reply(style.renderInfo(['Truth', '', question]));
  },
};
