// @legacy-order {"sourceFile":"10-divers/encode.js","sourceOrder":84,"definitionIndex":0,"entryOrder":179}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['hex2text'],
  description: 'Encode/decode text: base64, hex, binary, rot13',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) return ctx.reply(style.renderError(['Usage: .hex2text <hex>']));
    try {
      const result = Buffer.from(text, 'hex').toString('utf8');
      return ctx.reply(style.renderInfo([
        'Text from Hex',
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
