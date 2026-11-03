'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['rps', 'rockpaperscissors'],
  description: 'Rock Paper Scissors',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const choices = ['rock', 'paper', 'scissors'];
    const emojis = { rock: '🪨', paper: '📄', scissors: '✂️' };
    const pick = (args[0] || '').toLowerCase();

    if (!choices.includes(pick)) {
      return ctx.reply(style.renderError(['Usage', '', '.rps rock/paper/scissors']));
    }

    const bot = choices[Math.floor(Math.random() * choices.length)];
    let result;
    if (pick === bot) result = "It's a tie! 🤝";
    else if (
      (pick === 'rock' && bot === 'scissors') ||
      (pick === 'paper' && bot === 'rock') ||
      (pick === 'scissors' && bot === 'paper')
    ) result = 'You win! 🎉';
    else result = 'I win! 😎';

    await ctx.reply(style.renderInfo([`${emojis[pick]} vs ${emojis[bot]}`, '', result]));
  },
};
