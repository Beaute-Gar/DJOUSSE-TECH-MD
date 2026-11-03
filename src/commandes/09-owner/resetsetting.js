'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":515}
module.exports = require('./_owner-setting')({
  command: 'resetsetting',
  description: 'Reset a runtime setting',
  usage: '.resetsetting <KEY>',
  run(ctx, config) {
    const key = ctx.args[0] && ctx.args[0].toUpperCase();
    if (!key) return { error: true, lines: ['USAGE: .resetsetting <KEY>'] };
    delete config[key];
    delete process.env[key];
    return { lines: [`SETTING ${key} RESET TO DEFAULT.`] };
  },
});
