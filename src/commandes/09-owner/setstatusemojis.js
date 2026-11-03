'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":499}
module.exports = require('./_owner-setting')({
  command: 'setstatusemojis',
  description: 'Set status reaction emojis',
  usage: '.setstatusemojis <emoji1,emoji2,...>',
  run(ctx, config) {
    const text = ctx.args.join(' ').trim();
    if (!text) {
      return { error: true, lines: ['USAGE: .setstatusemojis <emoji1,emoji2,...>'] };
    }
    config.STATUS_EMOJIS = text.split(',').map((emoji) => emoji.trim());
    return { lines: [`STATUS REACTION EMOJIS SET: ${text}`] };
  },
});
