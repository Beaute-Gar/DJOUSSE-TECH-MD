// @legacy-order {"sourceFile":"07-fun/games3.js","sourceOrder":95,"definitionIndex":0,"entryOrder":244}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['tttjoin'],
  description: 'Get help joining a Tic-Tac-Toe game',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    await ctx.reply(style.renderInfo([
      'Tic-Tac-Toe',
      '',
      'Start a game with .ttt new, then invite a player with .tttjoin @user.',
    ]));
  },
};
