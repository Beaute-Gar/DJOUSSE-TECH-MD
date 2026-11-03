'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":505}
module.exports = require('./_owner-setting')({
  command: 'setautoread',
  description: 'Toggle automatic read receipts',
  usage: '.setautoread on|off',
  run(ctx, config) {
    const sub = (ctx.args[0] || 'on').toLowerCase();
    const value = sub === 'on' || sub === 'enable' || sub === 'true';
    config.AUTOREAD = value;
    return { lines: [`SETAUTOREAD → ${value ? 'ON' : 'OFF'}`] };
  },
});
