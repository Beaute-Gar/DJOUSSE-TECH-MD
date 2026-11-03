// @legacy-order {"sourceFile":"07-fun/emoji-games.js","sourceOrder":82,"definitionIndex":5,"entryOrder":169}
'use strict';
const style = require('../../config/style');
const state = require('./_quiz-state');

function reply(ctx, text, renderer = style.renderInfo) {
  return ctx.reply(renderer(String(text).split('\n')));
}

module.exports = {
  commands: ['mathanswer', 'ma'],
  description: 'Answer math quiz',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const key = `${ctx.from}_mq`;
    if (state[key] === undefined) return reply(ctx, 'Start with .mathquiz first!');

    const answer = state[key];
    if (parseInt(args[0]) === answer) {
      delete state[key];
      return reply(ctx, '✅ *Correct!* 🎉', style.renderSuccess);
    }

    delete state[key];
    return reply(ctx, `❌ Wrong! The answer was *${answer}*`, style.renderError);
  },
};
