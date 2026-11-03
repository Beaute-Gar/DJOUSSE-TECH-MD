'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":503}
module.exports = require('./_owner-setting')({
  command: 'setautolikestatus',
  description: 'Toggle automatic status likes',
  usage: '.setautolikestatus on|off',
  run(ctx, config) {
    const sub = (ctx.args[0] || 'on').toLowerCase();
    const value = sub === 'on' || sub === 'enable' || sub === 'true';
    config.AUTOLIKESTATUS = value;
    return { lines: [`SETAUTOLIKESTATUS → ${value ? 'ON' : 'OFF'}`] };
  },
});
