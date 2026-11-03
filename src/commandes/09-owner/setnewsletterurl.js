'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":497}
module.exports = require('./_owner-setting')({
  command: 'setnewsletterurl',
  description: 'Set newsletter URL',
  usage: '.setnewsletterurl <url>',
  run(ctx, config) {
    const text = ctx.args.join(' ').trim();
    if (!text) return { error: true, lines: ['USAGE: .setnewsletterurl <url>'] };
    config.NEWSLETTER_URL = text;
    return { lines: ['NEWSLETTER URL SET.'] };
  },
});
