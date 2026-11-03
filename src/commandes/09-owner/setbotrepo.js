'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":488}
module.exports = require('./_owner-setting')({
  command: 'setbotrepo',
  description: 'Set repository URL',
  usage: '.setbotrepo <github url>',
  run(ctx, config) {
    const text = ctx.args.join(' ').trim();
    if (!text) return { error: true, lines: ['USAGE: .setbotrepo <github url>'] };
    config.REPO_URL = text;
    return { lines: [`REPO URL SET TO ${text}`] };
  },
});
