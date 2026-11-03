'use strict';
// @legacy-order {"sourceFile":"05-outils/dev-tools.js","sourceOrder":73,"definitionIndex":3,"entryOrder":135}

const crypto = require('crypto');
const style = require('../../config/style');

module.exports = {
  commands: ['md5', 'sha256'],
  description: 'Hash text',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .hash <text>']));
    }

    const hashes = ['md5', 'sha1', 'sha256'].map((algorithm) =>
      `${algorithm.toUpperCase()}: ${crypto.createHash(algorithm).update(text).digest('hex')}`
    );
    return ctx.reply(style.renderInfo(['🔐 *Hash Results*', '', ...hashes]));
  },
};
