'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":514}
module.exports = require('./_owner-setting')({
  command: 'setsetting',
  description: 'Set a runtime setting',
  usage: '.setsetting <KEY> <value>',
  run(ctx, config) {
    const key = ctx.args[0] && ctx.args[0].toUpperCase();
    const value = ctx.args.slice(1).join(' ');
    if (!key || !value) {
      return { error: true, lines: ['USAGE: .setsetting <KEY> <value>'] };
    }
    config[key] = value;
    process.env[key] = value;
    return { lines: [`SET ${key} = ${value}`] };
  },
});
