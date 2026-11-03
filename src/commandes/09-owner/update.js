// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":482}
'use strict';

const createOwnerSetting = require('./_owner-setting');

module.exports = createOwnerSetting({
  command: 'update',
  description: 'Show bot update information',
  usage: '.update',
  run() {
    return {
      lines: [
        'BOT UPDATE',
        'CURRENT VERSION RUNNING.',
        'TO UPDATE: RESTART THE WORKFLOW OR PULL THE LATEST CODE.',
        'AUTO-UPDATE IS NOT SUPPORTED IN THIS ENVIRONMENT.',
      ],
    };
  },
});
