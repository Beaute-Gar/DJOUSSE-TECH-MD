'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":500}
module.exports = require('./_owner-setting')({
  command: 'setstatusreplytext',
  description: 'Set status reply text',
  usage: '.setstatusreplytext <text>',
  run(ctx, config) {
    const text = ctx.args.join(' ').trim();
    if (!text) {
      return { error: true, lines: ['USAGE: .setstatusreplytext <text>'] };
    }
    config.STATUS_REPLY_TEXT = text;
    return { lines: ['STATUS REPLY TEXT SET.'] };
  },
});
