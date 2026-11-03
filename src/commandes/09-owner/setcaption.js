'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":489}
module.exports = require('./_owner-setting')({
  command: 'setcaption',
  description: 'Set media caption',
  usage: '.setcaption <text>',
  run(ctx, config) {
    const text = ctx.args.join(' ').trim();
    config.CAPTION = text;
    return { lines: [`CAPTION SET TO: ${text || '(removed)'}`] };
  },
});
