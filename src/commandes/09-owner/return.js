// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":483}
'use strict';

const createOwnerSetting = require('./_owner-setting');

module.exports = createOwnerSetting({
  command: 'return',
  description: 'Show bot operational status',
  usage: '.return',
  run() {
    return {
      lines: [
        'RETURN',
        'BOT IS OPERATIONAL.',
        'ALL SYSTEMS NORMAL.',
      ],
    };
  },
});
