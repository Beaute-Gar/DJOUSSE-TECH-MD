'use strict';
// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":24,"entryOrder":666}

const style = require('../../config/style');

module.exports = {
  commands: ['emojify', 'textemoji'],
  description: 'Convert letters to emoji',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .emojify <text>']));
    }

    const map = {
      a: '🅰️', b: '🅱️', c: '©️', d: '🇩', e: '📧', f: '🎏',
      g: '🇬', h: '♓', i: 'ℹ️', j: '🎷', k: '🎋', l: '🕒',
      m: 'Ⓜ️', n: '🇳', o: '⭕', p: '🅿️', q: '🇶', r: '®️',
      s: '💲', t: '✝️', u: '⛎', v: '♈', w: '〰️', x: '❌',
      y: '💴', z: '💤', ' ': '  ',
    };
    const converted = text.toLowerCase().split('').map((character) =>
      map[character] || character
    ).join(' ');
    return ctx.reply(style.renderInfo([converted]));
  },
};
