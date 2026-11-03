'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":508}
module.exports = require('./_owner-setting')({
  command: 'setautoblock',
  description: 'Toggle auto block',
  usage: '.setautoblock on|off',
  run(ctx, config) {
    const sub = (ctx.args[0] || 'on').toLowerCase();
    const value = sub === 'on' || sub === 'enable' || sub === 'true';
    config.AUTOBLOCK = value;
    return { lines: [`SETAUTOBLOCK → ${value ? 'ON' : 'OFF'}`] };
  },
});
