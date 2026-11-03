// @legacy-order {"sourceFile":"10-divers/encode.js","sourceOrder":84,"definitionIndex":0,"entryOrder":180}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['rot13'],
  description: 'Encode/decode text: base64, hex, binary, rot13',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) return ctx.reply(style.renderError(['Usage: .rot13 <text>']));
    const result = text.replace(/[a-zA-Z]/g, (char) => String.fromCharCode(
      char.charCodeAt(0) + (char.toLowerCase() < 'n' ? 13 : -13),
    ));
    return ctx.reply(style.renderInfo([
      'ROT13',
      '',
      `Input: ${text.slice(0, 100)}`,
      '',
      `Output:\n${result}`,
    ]));
  },
};
