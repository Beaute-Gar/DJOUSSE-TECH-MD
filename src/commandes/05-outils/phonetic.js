// @legacy-order {"sourceFile":"05-outils/education.js","sourceOrder":81,"definitionIndex":13,"entryOrder":163}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['phonetic', 'nato'],
  description: 'NATO phonetic alphabet',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .nato <text>']));
    }

    const alphabet = {
      A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo',
      F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliet',
      K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar',
      P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango',
      U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee',
      Z: 'Zulu',
    };
    const result = text.toUpperCase().split('').map(character => alphabet[character] || character).join(' - ');
    return ctx.reply(style.renderInfo([`🔤 *NATO Phonetic*\n\n${result}`]));
  },
};
