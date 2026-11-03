// @legacy-order {"sourceFile":"05-outils/misc-extras.js","sourceOrder":144,"definitionIndex":4,"entryOrder":427}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['waves', 'textwave'],
  description: 'Wave text effect',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .waves <text>']));
    }

    const superscript = 'ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖᑫʳˢᵗᵘᵛʷˣʸᶻ';
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const result = text.toLowerCase().split('').map((character, index) => {
      const alphabetIndex = alphabet.indexOf(character);
      if (alphabetIndex === -1) return character;
      return index % 2 === 0 ? character.toUpperCase() : [...superscript][alphabetIndex] || character;
    }).join('');
    return ctx.reply(style.renderInfo([result]));
  },
};
