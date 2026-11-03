// @legacy-order {"sourceFile":"10-divers/encode.js","sourceOrder":84,"definitionIndex":0,"entryOrder":178}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['decode'],
  description: 'Encode/decode text: base64, hex, binary, rot13',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) return ctx.reply(style.renderError(['Usage: .decode <base64>']));
    try {
      const result = Buffer.from(text, 'base64').toString('utf8');
      return ctx.reply(style.renderInfo([
        'Decoded (Base64)',
        '',
        `Input: ${text.slice(0, 100)}`,
        '',
        `Output:\n${result}`,
      ]));
    } catch (error) {
      return ctx.reply(style.renderError([`Encode/decode failed: ${error.message}`]));
    }
  },
};
