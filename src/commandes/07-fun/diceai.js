// @legacy-order {"sourceFile":"07-fun/games3.js","sourceOrder":95,"definitionIndex":0,"entryOrder":238}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['diceai'],
  description: 'Roll dice against the AI',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    const playerRoll = Math.floor(Math.random() * 6) + 1;
    const aiRoll = Math.floor(Math.random() * 6) + 1;
    const emojis = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];
    const result = playerRoll > aiRoll
      ? '🏆 You win!'
      : playerRoll < aiRoll
        ? '🤖 AI wins!'
        : "🤝 It's a tie!";

    await ctx.reply(style.renderInfo([
      'Dice vs AI',
      '',
      `🧑 You: ${emojis[playerRoll]} (${playerRoll})`,
      `🤖 AI: ${emojis[aiRoll]} (${aiRoll})`,
      '',
      result,
    ]));
  },
};
