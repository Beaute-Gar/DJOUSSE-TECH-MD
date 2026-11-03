'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":512}
module.exports = require('./_owner-setting')({
  command: 'setantiedit',
  description: 'Toggle anti-edit',
  usage: '.setantiedit on|off',
  run(ctx, config) {
    const sub = (ctx.args[0] || 'on').toLowerCase();
    const value = sub === 'on' || sub === 'enable' || sub === 'true';
    config.ANTIEDIT = value;
    return { lines: [`SETANTIEDIT → ${value ? 'ON' : 'OFF'}`] };
  },
});
