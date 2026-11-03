'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":507}
module.exports = require('./_owner-setting')({
  command: 'setautoreplystatus',
  description: 'Toggle automatic status replies',
  usage: '.setautoreplystatus on|off',
  run(ctx, config) {
    const sub = (ctx.args[0] || 'on').toLowerCase();
    const value = sub === 'on' || sub === 'enable' || sub === 'true';
    config.AUTOREPLYSTATUS = value;
    return { lines: [`SETAUTOREPLYSTATUS → ${value ? 'ON' : 'OFF'}`] };
  },
});
