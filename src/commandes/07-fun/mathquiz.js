// @legacy-order {"sourceFile":"07-fun/emoji-games.js","sourceOrder":82,"definitionIndex":4,"entryOrder":168}
'use strict';
const style = require('../../config/style');
const state = require('./_quiz-state');
const OPERATORS = ['+', '-', '×'];

module.exports = {
  commands: ['mathquiz', 'mq'],
  description: 'Quick math quiz',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const operator = OPERATORS[Math.floor(Math.random() * 3)];
    let first;
    let second;
    let answer;

    if (operator === '+') {
      first = Math.floor(Math.random() * 100);
      second = Math.floor(Math.random() * 100);
      answer = first + second;
    } else if (operator === '-') {
      first = Math.floor(Math.random() * 100) + 50;
      second = Math.floor(Math.random() * 50);
      answer = first - second;
    } else {
      first = Math.floor(Math.random() * 12) + 1;
      second = Math.floor(Math.random() * 12) + 1;
      answer = first * second;
    }

    state[`${ctx.from}_mq`] = answer;
    await ctx.reply(style.renderOutgoingText(
      `🔢 *Quick Math!*\n\n${first} ${operator} ${second} = ?\n\nReply with .mathanswer <number>`
    ));
  },
};
