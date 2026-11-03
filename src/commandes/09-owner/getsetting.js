'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":513}
module.exports = require('./_owner-setting')({
  command: 'getsetting',
  description: 'Read a runtime setting',
  usage: '.getsetting <key>',
  run(ctx, config) {
    const key = ctx.args[0] && ctx.args[0].toUpperCase();
    if (!key) return { error: true, lines: ['USAGE: .getsetting <key>'] };
    const value = config[key] ?? process.env[key] ?? 'not set';
    return { lines: [`SETTING: ${key}`, `VALUE: ${value}`] };
  },
});
