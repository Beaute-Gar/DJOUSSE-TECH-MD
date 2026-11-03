// @legacy-order {"sourceFile":"07-fun/numberguess.js","sourceOrder":153,"definitionIndex":0,"entryOrder":465}
'use strict';
const style = require('../../config/style');
const sessions = new Map();

function reply(ctx, text, renderer = style.renderInfo) {
  return ctx.reply(renderer(String(text).split('\n')));
}

module.exports = {
  commands: ['guessnumber'],
  description: 'Number guessing game (1–100)',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    const chatId = ctx.groupId || ctx.sender;
    const arg = args[0];

    if (!arg || arg === 'start') {
      sessions.set(chatId, { number: Math.floor(Math.random() * 100) + 1, tries: 0, maxTries: 7 });
      return reply(ctx, "🎲 *Number Guessing Game Started!*\n\nI'm thinking of a number between 1 and 100.\nYou have 7 tries.\n\nType: .ng <number>");
    }

    if (arg === 'stop') {
      const session = sessions.get(chatId);
      sessions.delete(chatId);
      return reply(ctx, session ? `🛑 Game stopped. The number was *${session.number}*.` : '❓ No active game.');
    }

    const guess = parseInt(arg);
    if (Number.isNaN(guess) || guess < 1 || guess > 100) {
      return reply(ctx, '❌ Enter a number between 1 and 100.', style.renderError);
    }

    const session = sessions.get(chatId);
    if (!session) return reply(ctx, '❓ No active game. Type .ng start to begin.');

    session.tries++;
    if (guess === session.number) {
      sessions.delete(chatId);
      return reply(ctx, `🎉 *Correct!* The number was *${session.number}*!\n🏆 You got it in ${session.tries} ${session.tries === 1 ? 'try' : 'tries'}!`, style.renderSuccess);
    }

    if (session.tries >= session.maxTries) {
      sessions.delete(chatId);
      return reply(ctx, `💀 *Game over!* The number was *${session.number}*.`, style.renderError);
    }

    const hint = guess < session.number ? '📈 Too low!' : '📉 Too high!';
    const left = session.maxTries - session.tries;
    return reply(ctx, `${hint} ${left} ${left === 1 ? 'try' : 'tries'} left.`);
  },
};
