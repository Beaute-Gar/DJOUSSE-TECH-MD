'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":509}
module.exports = require('./_owner-setting')({
  command: 'setautobio',
  description: 'Toggle auto bio',
  usage: '.setautobio on|off',
  run(ctx, config) {
    const sub = (ctx.args[0] || 'on').toLowerCase();
    const value = sub === 'on' || sub === 'enable' || sub === 'true';
    config.AUTOBIO = value;
    return { lines: [`SETAUTOBIO → ${value ? 'ON' : 'OFF'}`] };
  },
});
