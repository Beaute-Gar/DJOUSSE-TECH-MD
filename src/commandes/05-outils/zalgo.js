// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":27,"entryOrder":669}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['zalgo', 'creepy'],
  description: 'Zalgo creepy text',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .zalgo <text>']));
    }

    const marks = [
      '\u0300', '\u0301', '\u0302', '\u0303', '\u0304', '\u0305', '\u0306',
      '\u0307', '\u0308', '\u0309', '\u030A', '\u030B', '\u030C', '\u030D',
      '\u030E', '\u030F', '\u0310', '\u0311', '\u0312', '\u0313', '\u0314',
      '\u0315', '\u031A', '\u031B', '\u033D', '\u033E', '\u033F', '\u0340',
      '\u0341', '\u0342', '\u0343', '\u0344', '\u0346', '\u034A', '\u034B',
      '\u034C',
    ];
    const result = text.split('').map(character => {
      const count = Math.floor(Math.random() * 5) + 2;
      const additions = Array.from({ length: count }, () =>
        marks[Math.floor(Math.random() * marks.length)]).join('');
      return character + additions;
    }).join('');
    return ctx.reply(style.renderInfo([result]));
  },
};
