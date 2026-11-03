// @legacy-order {"sourceFile":"10-divers/encode.js","sourceOrder":84,"definitionIndex":0,"entryOrder":177}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['encode'],
  description: 'Encode/decode text: base64, hex, binary, rot13',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError([
        'Usage: .encode <text>',
        '.encode hex:<text> → Hex',
        '.encode rev:<text> → Reverse',
      ]));
    }

    let result;
    let label;
    if (text.startsWith('hex:')) {
      result = Buffer.from(text.slice(4)).toString('hex');
      label = 'Hex';
    } else if (text.startsWith('rev:')) {
      result = text.slice(4).split('').reverse().join('');
      label = 'Reversed';
    } else {
      result = Buffer.from(text).toString('base64');
      label = 'Base64';
    }
    return ctx.reply(style.renderInfo([
      label,
      '',
      `Input: ${text.slice(0, 100)}`,
      '',
      `Output:\n${result}`,
    ]));
  },
};
