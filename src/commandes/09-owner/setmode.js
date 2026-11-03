'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":471}
module.exports = require('./_owner-setting')({
  command: 'setmode',
  description: 'Set bot mode',
  usage: '.setmode <mode>',
  run(ctx, config) {
    const modes = ['public', 'private', 'group', 'inbox', 'both'];
    const mode = ctx.args[0] && ctx.args[0].toLowerCase();
    if (!mode || !modes.includes(mode)) {
      return { error: true, lines: ['USAGE: .setmode <mode>', `MODES: ${modes.join(', ')}`] };
    }
    config.MODE = mode;
    process.env.MODE = mode;
    return { lines: [`MODE SET TO ${mode}`] };
  },
});
