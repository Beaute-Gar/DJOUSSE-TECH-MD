// @legacy-order {"sourceFile":"07-fun/games3.js","sourceOrder":95,"definitionIndex":0,"entryOrder":237}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['games'],
  description: 'List available games',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    await ctx.reply(style.renderInfo([
      'Available Games',
      '',
      '🎲 Dice — .dice to create, .dicejoin to join, .diceend to finish',
      '🤖 Dice vs AI — .diceai for a quick single-player game',
      '',
      '⭕ Tic-Tac-Toe — .ttt new to start, .tttjoin to join, .tttboard to view',
      '',
      '📝 Word Chain — .wcgbegin to start, .wcg <word> to play, .wcgend to finish',
      '🤖 Word Chain AI — .wcgai for a word challenge',
      '',
      '🎰 Other — .roll, .8ball, .hangman, .trivia',
    ]));
  },
};
