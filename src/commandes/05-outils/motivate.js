'use strict';

const style = require('../../config/style');

const MESSAGES = Object.freeze([
  "You didn't come this far just to come this far. Keep pushing! 💪",
  'Every expert was once a beginner. Start today. 🌱',
  'Your only limit is your mind. Break through! 🧠',
  'Difficult roads lead to beautiful destinations. 🛤️',
  'The best time to start was yesterday. The second best time is now. ⏰',
  'Believe in yourself. You are capable of amazing things. ✨',
  "Small progress is still progress. Don't give up! 📈",
  'Your future self will thank you for the effort you put in today. 🔮',
  'Champions keep playing until they get it right. 🏆',
  'Success is about being better than you were yesterday. 📊',
  "Don't wait for opportunity. Create it! 🔨",
  'The only person you should try to be better than is the person you were yesterday. 🌟',
  'Dream big. Work hard. Stay focused. 🎯',
  'You are stronger than you think. 💪',
  'Today is a new day. Make it count! ☀️',
]);

module.exports = {
  commands: ['motivate'],
  description: 'Send a motivational message',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const text = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    await ctx.reply(style.renderInfo(['Motivation', '', text]));
  },
};
