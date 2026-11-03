// @legacy-order {"sourceFile":"07-fun/emoji-games.js","sourceOrder":82,"definitionIndex":0,"entryOrder":164}
'use strict';
const style = require('../../config/style');
const state = require('./_quiz-state');
const PUZZLES = [
  { emoji: '🎬🦁👑', answer: 'The Lion King' },
  { emoji: '🕷️🧑', answer: 'Spider-Man' },
  { emoji: '⭐⚔️', answer: 'Star Wars' },
  { emoji: '🧊🏔️❄️', answer: 'Frozen' },
  { emoji: '🦇🧑', answer: 'Batman' },
  { emoji: '🧙‍♂️💍', answer: 'Lord of the Rings' },
  { emoji: '👻👻👻', answer: 'Ghostbusters' },
  { emoji: '🚢❄️💑', answer: 'Titanic' },
  { emoji: '🏠👆', answer: 'Up' },
  { emoji: '🧸🍯', answer: 'Winnie the Pooh' },
  { emoji: '🐠🔍', answer: 'Finding Nemo' },
  { emoji: '🤖🌱', answer: 'Wall-E' },
  { emoji: '👸❄️⛄', answer: 'Frozen' },
  { emoji: '🦁🐗🐾', answer: 'The Lion King' },
  { emoji: '🧛🩸', answer: 'Dracula' },
];

module.exports = {
  commands: ['emojiguess', 'eg'],
  description: 'Guess the emoji meaning',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const puzzle = PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
    state[`${ctx.from}_eg`] = puzzle.answer;
    await ctx.reply(style.renderOutgoingText(
      `🎬 *Guess the Movie!*\n\n${puzzle.emoji}\n\nReply with .emojianswer <your guess>`
    ));
  },
};
