// @legacy-order {"sourceFile":"07-fun/emoji-games.js","sourceOrder":82,"definitionIndex":9,"entryOrder":173}
'use strict';
const style = require('../../config/style');
const state = require('./_quiz-state');

function reply(ctx, text, renderer = style.renderInfo) {
  return ctx.reply(renderer(String(text).split('\n')));
}

module.exports = {
  commands: ['unscrambleanswer', 'usa'],
  description: 'Answer unscramble',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const key = `${ctx.from}_us`;
    if (!state[key]) return reply(ctx, 'Start with .unscramble2 first!');

    if (args[0]?.toLowerCase() === state[key]) {
      delete state[key];
      return reply(ctx, '✅ *Correct!* 🎉', style.renderSuccess);
    }

    return reply(ctx, '❌ Wrong! Try again.', style.renderError);
  },
};
