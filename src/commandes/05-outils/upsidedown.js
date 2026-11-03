// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":7,"entryOrder":650}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['upsidedown'],
  description: 'Flip text upside down',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .flip <text>']));
    }

    const map = {
      a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ',
      i: 'ᴉ', j: 'ɾ', k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd',
      q: 'b', r: 'ɹ', s: 's', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x',
      y: 'ʎ', z: 'z', '!': '¡', '?': '¿', '.': '˙', ',': '\'',
    };
    const result = text.toLowerCase().split('')
      .map(character => map[character] || character).reverse().join('');
    return ctx.reply(style.renderInfo([result]));
  },
};
