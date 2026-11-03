// @legacy-order {"sourceFile":"07-fun/games.js","sourceOrder":94,"definitionIndex":4,"entryOrder":223}
'use strict';
const style = require('../../config/style');
const games = require('./_quiz-state');

module.exports = {
  commands: ['ans'],
  description: "Answer trivia",
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const key = `${ctx.from}_trivia`;
    const correct = games[key];
    if (!correct) {
      return ctx.reply(style.renderError(['No active trivia!', 'Start one with .trivia']));
    }

    delete games[key];
    const userAnswer = args.join(' ').toLowerCase();
    const normalizedAnswer = correct.toLowerCase();
    if (normalizedAnswer.includes(userAnswer) || userAnswer.includes(normalizedAnswer)) {
      return ctx.reply(style.renderSuccess(['✅ Correct!', `The answer is: ${correct}`]));
    }
    return ctx.reply(style.renderError([`❌ Wrong! The answer was: *${correct}*`]));
  },
};
