'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":502}
module.exports = require('./_owner-setting')({
  command: 'setytlink',
  description: 'Set YouTube channel link',
  usage: '.setytlink <youtube channel url>',
  run(ctx, config) {
    const text = ctx.args.join(' ').trim();
    if (!text) return { error: true, lines: ['USAGE: .setytlink <youtube channel url>'] };
    config.YT_LINK = text;
    return { lines: ['YOUTUBE LINK SET.'] };
  },
});
