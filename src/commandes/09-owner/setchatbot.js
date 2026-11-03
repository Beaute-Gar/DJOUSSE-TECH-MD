'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":490}
module.exports = require('./_owner-setting')({
  command: 'setchatbot',
  description: 'Toggle chatbot',
  usage: '.setchatbot on|off',
  run(ctx, config) {
    const sub = (ctx.args[0] || 'on').toLowerCase();
    config.CHATBOT = sub === 'on' || sub === 'enable';
    return { lines: [`CHATBOT ${config.CHATBOT ? 'ON' : 'OFF'}`] };
  },
});
