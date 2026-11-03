'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":477}
module.exports = require('./_owner-setting')({
  command: 'setownernumber',
  description: 'Set owner phone number',
  usage: '.setownernumber <number>',
  run(ctx, config) {
    const num = ctx.args.join(' ').trim().replace(/\D/g, '');
    if (!num) return { error: true, lines: ['USAGE: .setownernumber <number>'] };
    config.OWNER_NUMBER = num;
    process.env.OWNER_NUMBER = num;
    return { lines: [`OWNER NUMBER SET TO +${num}`] };
  },
});
