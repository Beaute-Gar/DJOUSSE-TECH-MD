// @legacy-order {"sourceFile":"07-fun/emoji-games.js","sourceOrder":82,"definitionIndex":7,"entryOrder":171}
'use strict';
const style = require('../../config/style');
const state = require('./_quiz-state');

function reply(ctx, text, renderer = style.renderInfo) {
  return ctx.reply(renderer(String(text).split('\n')));
}

module.exports = {
  commands: ['capitalanswer', 'ca'],
  description: 'Answer capital quiz',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const key = `${ctx.from}_cq`;
    if (!state[key]) return reply(ctx, 'Start with .capitalquiz first!');

    const answer = state[key];
    const guess = args.join(' ').toLowerCase();
    if (answer.toLowerCase() === guess || answer.toLowerCase().includes(guess)) {
      delete state[key];
      return reply(ctx, `✅ *Correct!* It's ${answer}!`, style.renderSuccess);
    }

    delete state[key];
    return reply(ctx, `❌ Wrong! The answer was *${answer}*`, style.renderError);
  },
};
