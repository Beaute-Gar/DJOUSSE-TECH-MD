'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":486}
module.exports = require('./_owner-setting')({
  command: 'setpackauthor',
  description: 'Set sticker pack author',
  usage: '.setpackauthor <name>',
  run(ctx, config) {
    const text = ctx.args.join(' ').trim();
    if (!text) return { error: true, lines: ['USAGE: .setpackauthor <name>'] };
    config.PACK_AUTHOR = text;
    return { lines: [`STICKER PACK AUTHOR SET TO ${text}`] };
  },
});
