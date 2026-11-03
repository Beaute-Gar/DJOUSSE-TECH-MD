'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":484}
module.exports = require('./_owner-setting')({
  command: 'setpmpermit',
  description: 'Toggle private-message permit',
  usage: '.setpmpermit on|off',
  run(ctx, config) {
    const sub = (ctx.args[0] || 'on').toLowerCase();
    const value = sub === 'on' || sub === 'enable' || sub === 'true';
    config.PMPERMIT = value;
    return { lines: [`SETPMPERMIT → ${value ? 'ON' : 'OFF'}`] };
  },
});
