'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":495}
module.exports = require('./_owner-setting')({
  command: 'setgcpresence',
  description: 'Set group presence',
  usage: '.setgcpresence <type>',
  run(ctx, config) {
    const types = ['available', 'unavailable', 'composing', 'recording', 'paused'];
    const type = ctx.args[0] && ctx.args[0].toLowerCase();
    if (!type || !types.includes(type)) {
      return { error: true, lines: ['USAGE: .setgcpresence <type>', `TYPES: ${types.join(', ')}`] };
    }
    config.GC_PRESENCE = type;
    return { lines: [`GROUP PRESENCE SET TO ${type}`] };
  },
});
