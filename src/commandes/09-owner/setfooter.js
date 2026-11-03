'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":493}
module.exports = require('./_owner-setting')({
  command: 'setfooter',
  description: 'Set footer text',
  usage: '.setfooter <footer text>',
  run(ctx, config) {
    const text = ctx.args.join(' ').trim();
    if (!text) return { error: true, lines: ['USAGE: .setfooter <footer text>'] };
    config.FOOTER = text;
    return { lines: [`FOOTER SET TO: ${text}`] };
  },
});
