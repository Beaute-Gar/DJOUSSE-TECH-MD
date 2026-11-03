'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":491}
module.exports = require('./_owner-setting')({
  command: 'setchatbotmode',
  description: 'Toggle chatbot mode',
  usage: '.setchatbotmode on|off',
  run(ctx, config) {
    const sub = (ctx.args[0] || 'on').toLowerCase();
    config.CHATBOT = sub === 'on' || sub === 'enable';
    return { lines: [`CHATBOT ${config.CHATBOT ? 'ON' : 'OFF'}`] };
  },
});
