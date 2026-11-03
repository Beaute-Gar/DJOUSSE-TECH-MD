'use strict';
// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":6,"entryOrder":649}
const style = require('../../config/style');

module.exports = {
  commands: ['smallcaps'],
  description: 'Convert to small caps',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .tiny <text>']));
    }

    const map = {
      a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ',
      h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ',
      o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 'ꜱ', t: 'ᴛ', u: 'ᴜ',
      v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
    };
    const converted = text.toLowerCase().split('').map((character) =>
      map[character] || character
    ).join('');
    return ctx.reply(style.renderInfo([converted]));
  },
};
