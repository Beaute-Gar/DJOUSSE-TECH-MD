'use strict';

const style = require('../../config/style');

const SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
const SYMBOLS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
const PREDICTIONS = [
  'Today brings unexpected opportunities. Stay open to new connections.',
  'Your creativity is at a peak. Use this energy to start something new.',
  'Financial matters require careful attention today.',
  'Love is in the air! Express your feelings to someone special.',
  'Take time for self-care today. Your body needs rest.',
  'A challenging situation will reveal your true strength.',
  'Good news is on the way. Be patient and trust the process.',
  'Your social circle will expand today. Embrace new friendships.',
  'Focus on your goals. Small steps lead to big achievements.',
  'Communication is key today. Express yourself clearly.',
];
const COLORS = ['Red', 'Blue', 'Green', 'Gold', 'Purple', 'White', 'Pink', 'Orange'];

module.exports = {
  commands: ['horoscope2', 'dailyhoroscope'],
  description: 'Daily horoscope',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const sign = (args[0] || '').toLowerCase();
    const signIndex = SIGNS.indexOf(sign);
    if (signIndex < 0) {
      return ctx.reply(style.renderError([
        'Usage',
        '',
        '.horoscope2 <sign>',
        `Signs: ${SIGNS.join(', ')}`,
      ]));
    }

    const prediction = PREDICTIONS[Math.floor(Math.random() * PREDICTIONS.length)];
    const luckyNumber = Math.floor(Math.random() * 99) + 1;
    const luckyColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    const title = `${SYMBOLS[signIndex]} ${sign.charAt(0).toUpperCase()}${sign.slice(1)} - Daily Horoscope`;
    await ctx.reply(style.renderInfo([
      title,
      '',
      prediction,
      '',
      `Lucky number: ${luckyNumber}`,
      `Lucky color: ${luckyColor}`,
    ]));
  },
};
