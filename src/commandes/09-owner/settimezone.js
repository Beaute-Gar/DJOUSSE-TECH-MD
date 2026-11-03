'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":501}
module.exports = require('./_owner-setting')({
  command: 'settimezone',
  description: 'Set process timezone',
  usage: '.settimezone <timezone>',
  run(ctx, config) {
    const text = ctx.args.join(' ').trim();
    if (!text) {
      return {
        error: true,
        lines: ['USAGE: .settimezone <timezone>', 'EXAMPLE: .settimezone Africa/Douala'],
      };
    }
    process.env.TZ = text;
    config.TIMEZONE = text;
    return { lines: [`TIMEZONE SET TO ${text}`] };
  },
});
