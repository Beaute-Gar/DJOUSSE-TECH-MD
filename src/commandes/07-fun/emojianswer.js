// @legacy-order {"sourceFile":"07-fun/emoji-games.js","sourceOrder":82,"definitionIndex":1,"entryOrder":165}
'use strict';
const style = require('../../config/style');
const state = require('./_quiz-state');

function reply(ctx, text, renderer = style.renderInfo) {
  return ctx.reply(renderer(String(text).split('\n')));
}

module.exports = {
  commands: ['emojianswer', 'ea'],
  description: 'Answer emoji guess',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const key = `${ctx.from}_eg`;
    if (!state[key]) return reply(ctx, 'Start a game with .emojiguess first!');

    const answer = state[key];
    const guess = args.join(' ').toLowerCase();
    if (answer.toLowerCase().includes(guess) || guess.includes(answer.toLowerCase())) {
      delete state[key];
      return reply(ctx, `✅ *Correct!* It's "${answer}"!`, style.renderSuccess);
    }

    return reply(ctx, '❌ Wrong! Try again or .emojiguess for a new one.', style.renderError);
  },
};
