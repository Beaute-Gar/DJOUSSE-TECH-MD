'use strict';
// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":20,"entryOrder":662}

const style = require('../../config/style');

module.exports = {
  commands: ['unmorse', 'demorse'],
  description: 'Convert from Morse code',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .unmorse <morse>']));
    }

    const map = {
      '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
      '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
      '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
      '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
      '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
      '--..': 'Z', '.----': '1', '..---': '2', '...--': '3',
      '....-': '4', '.....': '5', '-....': '6', '--...': '7',
      '---..': '8', '----.': '9', '-----': '0', '/': ' ',
    };
    const decoded = text.split(' ').map((code) => map[code] || '?').join('');
    return ctx.reply(style.renderInfo([decoded]));
  },
};
