'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":506}
module.exports = require('./_owner-setting')({
  command: 'setautoreadstatus',
  description: 'Toggle automatic status-read receipts',
  usage: '.setautoreadstatus on|off',
  run(ctx, config) {
    const sub = (ctx.args[0] || 'on').toLowerCase();
    const value = sub === 'on' || sub === 'enable' || sub === 'true';
    config.AUTOREADSTATUS = value;
    return { lines: [`SETAUTOREADSTATUS → ${value ? 'ON' : 'OFF'}`] };
  },
});
