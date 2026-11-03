'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":511}
module.exports = require('./_owner-setting')({
  command: 'setantidelete',
  description: 'Toggle anti-delete',
  usage: '.setantidelete on|off',
  run(ctx, config) {
    const sub = (ctx.args[0] || 'on').toLowerCase();
    const value = sub === 'on' || sub === 'enable' || sub === 'true';
    config.ANTIDELETE = value;
    return { lines: [`SETANTIDELETE → ${value ? 'ON' : 'OFF'}`] };
  },
});
