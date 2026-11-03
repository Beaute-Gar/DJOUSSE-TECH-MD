'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":485}
module.exports = require('./_owner-setting')({
  command: 'setpackname',
  description: 'Set sticker pack name',
  usage: '.setpackname <name>',
  run(ctx, config) {
    const text = ctx.args.join(' ').trim();
    if (!text) return { error: true, lines: ['USAGE: .setpackname <name>'] };
    config.PACK_NAME = text;
    return { lines: [`STICKER PACK NAME SET TO ${text}`] };
  },
});
