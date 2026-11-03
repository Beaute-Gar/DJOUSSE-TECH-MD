'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":510}
module.exports = require('./_owner-setting')({
  command: 'setanticall',
  description: 'Toggle anti-call',
  usage: '.setanticall on|off',
  run(ctx, config) {
    const sub = (ctx.args[0] || 'on').toLowerCase();
    const value = sub === 'on' || sub === 'enable' || sub === 'true';
    config.ANTICALL = value;
    return { lines: [`SETANTICALL → ${value ? 'ON' : 'OFF'}`] };
  },
});
