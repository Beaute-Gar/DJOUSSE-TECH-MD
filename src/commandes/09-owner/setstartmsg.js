'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":498}
module.exports = require('./_owner-setting')({
  command: 'setstartmsg',
  description: 'Set start message',
  usage: '.setstartmsg <message>',
  run(ctx, config) {
    const text = ctx.args.join(' ').trim();
    if (!text) return { error: true, lines: ['USAGE: .setstartmsg <message>'] };
    config.START_MSG = text;
    return { lines: ['START MESSAGE UPDATED.'] };
  },
});
