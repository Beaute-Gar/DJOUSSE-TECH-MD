'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":476}
module.exports = require('./_owner-setting')({
  command: 'setownername',
  description: 'Set owner name',
  usage: '.setownername <name>',
  run(ctx, config) {
    const text = ctx.args.join(' ').trim();
    if (!text) return { error: true, lines: ['USAGE: .setownername <name>'] };
    config.OWNER_NAME = text;
    process.env.OWNER_NAME = text;
    return { lines: [`OWNER NAME SET TO ${text}`] };
  },
});
