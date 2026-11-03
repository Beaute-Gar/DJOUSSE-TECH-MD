'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":504}
module.exports = require('./_owner-setting')({
  command: 'setautoreact',
  description: 'Toggle automatic reactions',
  usage: '.setautoreact on|off',
  run(ctx, config) {
    const sub = (ctx.args[0] || 'on').toLowerCase();
    const value = sub === 'on' || sub === 'enable' || sub === 'true';
    config.AUTOREACT = value;
    return { lines: [`SETAUTOREACT → ${value ? 'ON' : 'OFF'}`] };
  },
});
