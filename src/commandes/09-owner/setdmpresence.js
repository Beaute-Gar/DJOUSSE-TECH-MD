'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":492}
module.exports = require('./_owner-setting')({
  command: 'setdmpresence',
  description: 'Set direct-message presence',
  usage: '.setdmpresence <type>',
  run(ctx, config) {
    const types = ['available', 'unavailable', 'composing', 'recording', 'paused'];
    const type = ctx.args[0] && ctx.args[0].toLowerCase();
    if (!type || !types.includes(type)) {
      return { error: true, lines: ['USAGE: .setdmpresence <type>', `TYPES: ${types.join(', ')}`] };
    }
    config.DM_PRESENCE = type;
    return { lines: [`DM PRESENCE SET TO ${type}`] };
  },
});
