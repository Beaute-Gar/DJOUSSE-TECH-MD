// @legacy-order {"sourceFile":"07-fun/games.js","sourceOrder":94,"definitionIndex":6,"entryOrder":224}
'use strict';
const style = require('../../config/style');
const games = require('./_quiz-state');

module.exports = {
  commands: ['solve'],
  description: "Solve riddle",
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const key = `${ctx.from}_riddle`;
    const answer = games[key];
    if (!answer) {
      return ctx.reply(style.renderError(['No active riddle!', 'Start one with .riddle']));
    }

    delete games[key];
    return ctx.reply(style.renderInfo([`💡 Answer: ${answer}`]));
  },
};
