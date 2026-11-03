'use strict';

const style = require('../../config/style');

const SCENARIOS = Object.freeze([
  'What would you do if you found $1 million on the street?',
  'What would you do if you could be any animal for a day?',
  'What would you do if you woke up on a deserted island?',
  'What would you do if you could meet any historical figure?',
  'What would you do if you had 24 hours to live?',
  'What would you do if you could switch lives with anyone?',
  'What would you do if you found a genie lamp?',
  'What would you do if aliens landed on Earth?',
  'What would you do if you could time travel?',
  'What would you do if you became president for a day?',
  'What would you do if you could read minds?',
  'What would you do if you won the lottery?',
  'What would you do if you could speak every language?',
  'What would you do if you were invisible for a day?',
  'What would you do if you could fly?',
]);

module.exports = {
  commands: ['wouldyou', 'wyd'],
  description: 'Generate a what-would-you-do scenario',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    await ctx.reply(style.renderInfo(['What Would You Do?', '', scenario]));
  },
};
