'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":496}
module.exports = require('./_owner-setting')({
  command: 'setnewsletterjid',
  description: 'Set newsletter JID',
  usage: '.setnewsletterjid <jid>',
  run(ctx, config) {
    const text = ctx.args.join(' ').trim();
    if (!text) return { error: true, lines: ['USAGE: .setnewsletterjid <jid>'] };
    config.NEWSLETTER_JID = text;
    return { lines: [`NEWSLETTER JID SET TO ${text}`] };
  },
});
