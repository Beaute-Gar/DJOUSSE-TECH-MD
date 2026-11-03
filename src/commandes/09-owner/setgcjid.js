'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":494}
module.exports = require('./_owner-setting')({
  command: 'setgcjid',
  description: 'Set group JID',
  usage: '.setgcjid <group jid>',
  run(ctx, config) {
    const text = ctx.args.join(' ').trim();
    if (!text) return { error: true, lines: ['USAGE: .setgcjid <group jid>'] };
    config.GROUP_JID = text;
    return { lines: [`GROUP JID SET TO ${text}`] };
  },
});
