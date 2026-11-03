// @legacy-order {"sourceFile":"07-fun/wordgame.js","sourceOrder":284,"definitionIndex":0,"entryOrder":775}
'use strict';
const style = require('../../config/style');

const WORDS = [
  'elephant', 'keyboard', 'mountain', 'freedom', 'science',
  'hospital', 'library', 'diamond', 'journey', 'horizon',
  'pyramid', 'thunder', 'whisper', 'gallery', 'captain',
  'dolphin', 'mystery', 'explore', 'balance', 'harmony',
];
const sessions = new Map();

function scramble(word) {
  const letters = word.split('');
  for (let index = letters.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [letters[index], letters[swapIndex]] = [letters[swapIndex], letters[index]];
  }
  const result = letters.join('');
  return result === word ? scramble(word) : result;
}

function reply(ctx, text, renderer = style.renderInfo) {
  return ctx.reply(renderer(String(text).split('\n')));
}

module.exports = {
  commands: ['ws'],
  description: 'Unscramble the word game',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    const chatId = ctx.groupId || ctx.sender;
    const argument = args[0]?.toLowerCase();

    if (argument && argument !== 'start' && argument !== 'hint') {
      const session = sessions.get(chatId);
      if (!session) {
        return reply(ctx, '❓ No active game. Type .ws to start.', style.renderError);
      }
      if (argument === session.word) {
        sessions.delete(chatId);
        return reply(ctx, `🎉 *Correct!* The word was *${session.word.toUpperCase()}*!`, style.renderSuccess);
      }
      return reply(ctx, `❌ Wrong! Try again. Scrambled: *${session.scrambled.toUpperCase()}*`, style.renderError);
    }

    if (argument === 'hint') {
      const session = sessions.get(chatId);
      if (!session) {
        return reply(ctx, '❓ No active game.', style.renderError);
      }
      return reply(
        ctx,
        `💡 Hint: The word starts with *${session.word[0].toUpperCase()}* and has *${session.word.length}* letters.`
      );
    }

    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    const session = { word, scrambled: scramble(word), startedAt: Date.now() };
    sessions.set(chatId, session);
    setTimeout(() => {
      if (sessions.get(chatId) !== session) return;
      sessions.delete(chatId);
      const text = style.renderInfo([`⏰ *Time's up!* The word was *${word.toUpperCase()}*.`]);
      sock.sendMessage(chatId, { text, contextInfo: ctx.contextInfo }).catch(() => {});
    }, 60000);

    return reply(
      ctx,
      `🔤 *Word Scramble*\n\nUnscramble this word:\n*${session.scrambled.toUpperCase()}*\n\n💡 Type .ws hint for a hint\n⏰ 60 seconds!`
    );
  },
};
