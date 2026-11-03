// @legacy-order {"sourceFile":"07-fun/emoji-games.js","sourceOrder":82,"definitionIndex":11,"entryOrder":175}
'use strict';
const style = require('../../config/style');
const state = require('./_quiz-state');

function reply(ctx, text, renderer = style.renderInfo) {
  return ctx.reply(renderer(String(text).split('\n')));
}

module.exports = {
  commands: ['typecheck', 'tc'],
  description: 'Check typing race',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const key = `${ctx.from}_tr`;
    if (!state[key]) return reply(ctx, 'Start with .typerace first!');

    const elapsed = (Date.now() - state[key].time) / 1000;
    const typed = args.join(' ');
    const correct = state[key].phrase;
    delete state[key];
    const accuracy = Math.round((typed.split('').filter((char, index) => char === correct[index]).length / correct.length) * 100);
    const wpm = Math.round((correct.split(' ').length / elapsed) * 60);
    const result = accuracy === 100
      ? '🏆 Perfect!'
      : accuracy > 80 ? '👍 Good job!' : '📝 Keep practicing!';

    return reply(ctx, `⌨️ *Typing Results*\n\nTime: ${elapsed.toFixed(1)}s\nWPM: ~${wpm}\nAccuracy: ${accuracy}%\n\n${result}`);
  },
};
